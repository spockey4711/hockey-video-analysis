import { execFileSync } from "node:child_process";

import { assertDisposableDatabase } from "./coach-flow-fixture";

/**
 * Migrate and seed the throwaway database before Playwright boots the app.
 * Without DATABASE_URL the home smoke can still start; the coach-flow spec
 * fails instead of being skipped.
 */
export default function globalSetup(): void {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return;
  assertDisposableDatabase(databaseUrl);

  const env = { ...process.env, DATABASE_URL: databaseUrl };
  execFileSync("pnpm", ["exec", "drizzle-kit", "migrate"], {
    env,
    stdio: "inherit",
  });
  execFileSync("pnpm", ["exec", "tsx", "tests/e2e/seed-coach-flow.ts"], {
    env,
    stdio: "inherit",
  });
}
