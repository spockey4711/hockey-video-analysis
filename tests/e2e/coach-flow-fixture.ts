/**
 * Throwaway coach and game for the Playwright coach-flow spec.
 *
 * The password is a fixture for the isolated e2e database only. It is not a
 * deployed secret and must never be pointed at a non-loopback database.
 */
export const E2E_COACH = {
  email: "e2e-coach@example.test",
  name: "E2E Coach",
  password: "e2e-only-not-a-secret",
} as const;

export const E2E_GAME = {
  title: "E2E Isoliertes Spiel",
  opponent: "E2E Gegner",
  playedOn: "2026-09-01",
  /** Chapter metadata only. The file is not created and is not served. */
  filePath: "e2e/missing-chapter.mp4",
  durationS: 90,
} as const;

/** Refuse anything that is not a loopback database marked as an e2e database. */
export function assertDisposableDatabase(databaseUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("e2e seed refuses a DATABASE_URL that is not a URL");
  }
  const host = parsed.hostname;
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
    throw new Error("e2e seed refuses a non-loopback database");
  }
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!name.includes("e2e")) {
    throw new Error(
      "e2e seed refuses a database whose name does not contain 'e2e'",
    );
  }
}
