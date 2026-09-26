import { beforeEach, describe, expect, it, vi } from "vitest";

// The action is exercised against mocked auth and queries: the DB and cookie
// store are boundaries, and what matters here is the order of the checks and
// that a successful change revokes every session before starting a new one.
const auth = vi.hoisted(() => ({
  getCurrentCoach: vi.fn(),
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
  createSession: vi.fn(),
  setSessionCookie: vi.fn(),
}));
const queries = vi.hoisted(() => ({
  getCoachPasswordHash: vi.fn(),
  replacePasswordAndRevokeSessions: vi.fn(),
}));

const MAC_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

vi.mock("@/lib/auth", () => auth);
vi.mock("@/features/settings/queries", () => queries);
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": MAC_CHROME }),
}));

import { _resetAll } from "@/features/access/rate-limit";
import { changePasswordAction } from "@/features/settings/actions";
import { settingsContent } from "@/features/settings/content";

const { errors } = settingsContent;
const COACH = { id: "coach-1", email: "coach@example.test", name: "Coach" };
const EXPIRES = new Date("2026-10-01T00:00:00Z");

function form(current: string, next: string, confirm = next): FormData {
  const data = new FormData();
  data.set("current", current);
  data.set("next", next);
  data.set("confirm", confirm);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  _resetAll();
  auth.getCurrentCoach.mockResolvedValue(COACH);
  auth.verifyPassword.mockImplementation(
    async (plain: string) => plain === "old-password",
  );
  auth.hashPassword.mockResolvedValue("new-hash");
  auth.createSession.mockResolvedValue({ token: "fresh", expiresAt: EXPIRES });
  queries.getCoachPasswordHash.mockResolvedValue("old-hash");
  queries.replacePasswordAndRevokeSessions.mockResolvedValue(undefined);
});

describe("changePasswordAction", () => {
  it("re-hashes, revokes every session, then signs this browser back in", async () => {
    const result = await changePasswordAction(
      {},
      form("old-password", "brand-new-password"),
    );

    expect(result).toEqual({ success: true });
    expect(auth.verifyPassword).toHaveBeenCalledWith(
      "old-password",
      "old-hash",
    );
    expect(auth.hashPassword).toHaveBeenCalledWith("brand-new-password");
    expect(queries.replacePasswordAndRevokeSessions).toHaveBeenCalledWith(
      COACH.id,
      "new-hash",
    );
    // The fresh session is a labelled web session; the Mac's device session
    // went with the revoke and is not restored.
    expect(auth.createSession).toHaveBeenCalledTimes(1);
    expect(auth.createSession).toHaveBeenCalledWith(COACH.id, {
      kind: "web",
      deviceName: "Chrome auf macOS",
    });
    expect(auth.setSessionCookie).toHaveBeenCalledWith("fresh", EXPIRES);
    // The fresh session must come after the revoke, or it would be deleted too.
    expect(
      queries.replacePasswordAndRevokeSessions.mock.invocationCallOrder[0],
    ).toBeLessThan(auth.createSession.mock.invocationCallOrder[0] ?? 0);
  });

  it("reports a lost session when nobody is signed in", async () => {
    auth.getCurrentCoach.mockResolvedValue(null);

    const result = await changePasswordAction(
      {},
      form("old-password", "brand-new-password"),
    );

    expect(result).toEqual({ error: errors.notSignedIn });
    expect(queries.replacePasswordAndRevokeSessions).not.toHaveBeenCalled();
  });

  it("returns field errors without touching the database", async () => {
    const result = await changePasswordAction(
      {},
      form("old-password", "brand-new-password", "something-else"),
    );

    expect(result.fieldErrors?.confirm).toBe(errors.confirmMismatch);
    expect(queries.getCoachPasswordHash).not.toHaveBeenCalled();
  });

  it("rejects a wrong current password and keeps every session", async () => {
    const result = await changePasswordAction(
      {},
      form("wrong-password", "brand-new-password"),
    );

    expect(result).toEqual({ fieldErrors: { current: errors.currentWrong } });
    expect(queries.replacePasswordAndRevokeSessions).not.toHaveBeenCalled();
    expect(auth.createSession).not.toHaveBeenCalled();
  });

  it("locks out current-password guessing after repeated failures", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await changePasswordAction(
        {},
        form("wrong-password", "brand-new-password"),
      );
    }

    const result = await changePasswordAction(
      {},
      form("old-password", "brand-new-password"),
    );

    expect(result).toEqual({ error: errors.tooManyAttempts });
    expect(queries.replacePasswordAndRevokeSessions).not.toHaveBeenCalled();
  });

  it("treats a vanished account as a lost session", async () => {
    queries.getCoachPasswordHash.mockResolvedValue(undefined);

    const result = await changePasswordAction(
      {},
      form("old-password", "brand-new-password"),
    );

    expect(result).toEqual({ error: errors.notSignedIn });
  });

  it("reports a failed update without signing anyone in", async () => {
    queries.replacePasswordAndRevokeSessions.mockRejectedValue(
      new Error("db down"),
    );

    const result = await changePasswordAction(
      {},
      form("old-password", "brand-new-password"),
    );

    expect(result).toEqual({ error: errors.unexpected });
    expect(auth.createSession).not.toHaveBeenCalled();
  });

  it("says the password changed when only the fresh session fails", async () => {
    auth.createSession.mockRejectedValue(new Error("db down"));

    const result = await changePasswordAction(
      {},
      form("old-password", "brand-new-password"),
    );

    expect(result).toEqual({ error: errors.changedButSignedOut });
  });
});
