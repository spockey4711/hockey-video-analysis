/**
 * Composition root of the Drive import worker: `pnpm worker:ingest` (P2-17).
 *
 * Reads the deployment-specific values from the environment, opens its own
 * database connection (the app's `@/lib/db` client is `server-only` and belongs
 * to the request path), and runs two loops side by side until the process is
 * asked to stop:
 *
 * - the import loop scans the read-only Drive mount every few minutes and
 *   registers each settled game folder as a needs-a-name game;
 * - the proxy loop encodes the missing 720p tagging proxies, one at a time,
 *   and shows an imported game to the coach once all its proxies exist.
 *
 * Runs as its own process next to the app and the clip worker, never inside the
 * web server: an encode takes tens of minutes. See ADR 0007 and ADR 0008.
 */
import { access } from "node:fs/promises";
import path from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import type { WorkerDatabase } from "@/features/clips/cut";
import {
  createImporter,
  createIngestRepository,
  createProxyEncoder,
  encodeProxy,
  probeMedia,
  runLoop,
  scanSourceRoot,
} from "@/features/ingest";
import * as schema from "@/lib/db/schema";

const MINUTE_MS = 60 * 1000;
/** How often the Drive root is scanned; minutes, to stay far below Drive quotas. */
const SCAN_INTERVAL_MS = 2 * MINUTE_MS;
/** How long the proxy loop waits when every proxy that can be made exists. */
const PROXY_IDLE_MS = 2 * MINUTE_MS;
/** First wait before re-probing a folder whose probe failed; it doubles. */
const PROBE_RETRY_MS = 5 * MINUTE_MS;
/** First wait before retrying a chapter whose proxy failed; it doubles, up to a day. */
const PROXY_RETRY_MS = 60 * MINUTE_MS;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} must be set to run the ingest worker`);
    process.exit(1);
  }
  return value;
}

function positiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    console.error(`${name} must be a positive whole number, got "${raw}"`);
    process.exit(1);
  }
  return value;
}

async function exists(absolutePath: string): Promise<boolean> {
  try {
    await access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const databaseUrl = requireEnv("DATABASE_URL");
  const sourceRoot = requireEnv("MEDIA_SOURCE_ROOT");
  const proxyRoot = requireEnv("MEDIA_PROXY_ROOT");
  const quietMinutes = positiveIntegerEnv("INGEST_QUIET_MINUTES", 120);
  const proxyThreads = positiveIntegerEnv("INGEST_PROXY_THREADS", 2);

  // Two loops, one query each at a time: two connections are plenty.
  const client = postgres(databaseUrl, { max: 2 });
  const db: WorkerDatabase = drizzle(client, { schema });
  const repository = createIngestRepository(db);

  const controller = new AbortController();
  const { signal } = controller;
  for (const name of ["SIGINT", "SIGTERM"] as const) {
    process.on(name, () => {
      console.info(`${name} received, stopping`);
      controller.abort();
    });
  }

  const importer = createImporter({
    repository,
    scan: () => scanSourceRoot(sourceRoot),
    probe: (relativePath) =>
      probeMedia(path.join(sourceRoot, relativePath), { signal }),
    now: () => new Date(),
    log: console,
    quietMs: quietMinutes * MINUTE_MS,
    probeRetryMs: PROBE_RETRY_MS,
  });

  const proxies = createProxyEncoder({
    sources: repository,
    sourceRoot,
    proxyRoot,
    exists,
    encode: (input) => encodeProxy({ ...input, threads: proxyThreads, signal }),
    now: () => new Date(),
    log: console,
    retryMs: PROXY_RETRY_MS,
  });

  console.info(
    `ingest worker started: sourceRoot=${sourceRoot} proxyRoot=${proxyRoot} ` +
      `quiet=${quietMinutes}min proxyThreads=${proxyThreads}`,
  );

  try {
    await Promise.all([
      runLoop(
        async () => {
          await importer.runPass();
          return false;
        },
        {
          intervalMs: SCAN_INTERVAL_MS,
          signal,
          onError: (error) => console.error("import pass failed:", error),
        },
      ),
      runLoop(() => proxies.encodeNext(), {
        intervalMs: PROXY_IDLE_MS,
        signal,
        onError: (error) => console.error("proxy round failed:", error),
      }),
    ]);
  } finally {
    await client.end({ timeout: 5 });
    console.info("ingest worker stopped");
  }
}

main().catch((error: unknown) => {
  console.error("ingest worker stopped: unrecoverable error", error);
  process.exit(1);
});
