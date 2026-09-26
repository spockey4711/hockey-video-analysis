import { beforeEach, describe, expect, it, vi } from "vitest";

// The credential check behind both the web login and the Mac's sign-in,
// against a mocked account lookup and password hash.
const queries = vi.hoisted(() => ({ findCoachByEmail: vi.fn() }));
const auth = vi.hoisted(() => ({
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(async () => "dummy-hash"),
  createSession: vi.fn(),
  setSessionCookie: vi.fn(),
}));

vi.mock("@/features/access/queries", () => queries);
vi.mock("@/lib/auth", () => auth);

import { _resetAll } from "@/features/access/rate-limit";
import { checkCredentials, clientIp } from "@/features/access/sign-in";

beforeEach(() => {
  vi.clearAllMocks();
  _resetAll();
  queries.findCoachByEmail.mockResolvedValue({
    id: "coach-1",
    passwordHash: "stored-hash",
  });
  auth.verifyPassword.mockImplementation(
    async (plain: string, hash: string) =>
      hash === "stored-hash" && plain === "right",
  );
});

describe("checkCredentials", () => {
  it("answers the coach for the right password", async () => {
    await expect(
      checkCredentials("coach@example.test", "right", "ip"),
    ).resolves.toEqual({ ok: true, coachId: "coach-1" });
  });

  it("answers the same for a wrong password and a missing account", async () => {
    const wrong = await checkCredentials("coach@example.test", "nope", "ip");
    queries.findCoachByEmail.mockResolvedValue(undefined);
    const missing = await checkCredentials("ghost@example.test", "right", "ip");

    expect(wrong).toEqual({ ok: false, reason: "invalid" });
    expect(missing).toEqual({ ok: false, reason: "invalid" });
    // A missing account still pays for a hash check (no timing oracle).
    expect(auth.verifyPassword).toHaveBeenLastCalledWith("right", "dummy-hash");
  });

  it("locks the address and email out after five failures", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await checkCredentials("coach@example.test", "nope", "ip");
    }

    const locked = await checkCredentials("coach@example.test", "right", "ip");

    expect(locked).toMatchObject({ ok: false, reason: "limited" });
    const other = await checkCredentials("coach@example.test", "right", "ip2");
    expect(other).toEqual({ ok: true, coachId: "coach-1" });
  });
});

describe("clientIp", () => {
  it("takes the first forwarded address", () => {
    expect(
      clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })),
    ).toBe("203.0.113.7");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
