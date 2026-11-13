import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 34731);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  use: { baseURL },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec next dev --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    timeout: 180_000,
    // Never attach to a server another process already owns. Set E2E_REUSE=1
    // only when that server is this app on the same port and database.
    reuseExistingServer: process.env.E2E_REUSE === "1",
    env: {
      ...process.env,
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
