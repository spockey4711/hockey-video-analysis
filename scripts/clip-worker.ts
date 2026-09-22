/**
 * Composition root of the clip cut worker: `pnpm worker:clips`.
 *
 * Reads the deployment-specific values from the environment, opens its own
 * database connection (the app's `@/lib/db` client is `server-only` and belongs
 * to the request path), wires the queue, the cutter and the loop, and runs until
 * the process is asked to stop.
 *
 * Runs as its own process next to the app, never inside it: a copy-cut takes
 * seconds and must not sit in a request, and a crashing cut must not take the
 * web server with it. See ADR 0007.
 */
import path from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  createClipQueue,
  cutClip,
  requeueStaleProcessing,
  runForever,
  type WorkerDatabase,
} from "@/features/clips/cut";
import * as schema from "@/lib/db/schema";

/** How long an idle worker waits before polling the queue again. */
const POLL_INTERVAL_MS = 5000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} must be set to run the clip worker`);
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  const databaseUrl = requireEnv("DATABASE_URL");
  const mediaRoot = requireEnv("CLIP_MEDIA_ROOT");
  // Relative to the media root, so the stored path resolves under
  // MEDIA_BASE_URL exactly like a chapter file does.
  const outputDir = process.env.CLIP_OUTPUT_DIR ?? "clips";

  // One connection is plenty: the worker cuts one clip at a time.
  const client = postgres(databaseUrl, { max: 1 });
  const db: WorkerDatabase = drizzle(client, { schema });
  const queue = createClipQueue(db);

  const controller = new AbortController();
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      console.info(`${signal} received, stopping after the current clip`);
      controller.abort();
    });
  }

  const requeued = await requeueStaleProcessing(db);
  if (requeued > 0) {
    console.info(`requeued ${requeued} clip(s) left processing by a prior run`);
  }
  console.info(
    `clip worker started: mediaRoot=${mediaRoot} outputDir=${outputDir} ` +
      `pollInterval=${POLL_INTERVAL_MS}ms`,
  );

  try {
    await runForever(
      {
        queue,
        cut: (plan, outputPath) => cutClip(plan, { mediaRoot, outputPath }),
        outputPathFor: (clipId) => `${outputDir}/${clipId}.mp4`,
        resolveOutput: (relativePath) => path.resolve(mediaRoot, relativePath),
      },
      { pollIntervalMs: POLL_INTERVAL_MS, signal: controller.signal },
    );
  } finally {
    await client.end({ timeout: 5 });
    console.info("clip worker stopped");
  }
}

main().catch((error: unknown) => {
  console.error("clip worker stopped: unrecoverable error", error);
  process.exit(1);
});
