import { beforeEach, describe, expect, it, vi } from "vitest";

// The route is exercised against a mocked sign-in and session store: what
// matters is the order of the gates, the status codes the Mac relies on, and
// that the raw token only ever appears in the one response that hands it out.
const signIn = vi.hoisted(() => ({
  checkCredentials: vi.fn(),
  clientIp: vi.fn(() => "203.0.113.7"),
}));
const auth = vi.hoisted(() => ({
  createSession: vi.fn(),
  getApiSession: vi.fn(),
  revokeSession: vi.fn(),
}));

vi.mock("@/features/access/sign-in", () => signIn);
vi.mock("@/lib/auth", () => auth);

import { DELETE, POST } from "@/app/api/app/v1/sessions/route";
import { MIN_APP_VERSION } from "@/features/app-api/version";

const TOKEN = "f".repeat(64);
const BODY = {
  email: " Coach@Example.test ",
  password: "correct-password",
  deviceName: "MacBook Pro von Alex",
};

function post(body: unknown, version: string | null = MIN_APP_VERSION) {
  const headers = new Headers({ "content-type": "application/json" });
  if (version !== null) headers.set("X-HVA-App-Version", version);
  return new Request("http://localhost/api/app/v1/sessions", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function del(version: string | null = MIN_APP_VERSION) {
  const headers = new Headers({ authorization: `Bearer ${TOKEN}` });
  if (version !== null) headers.set("X-HVA-App-Version", version);
  return new Request("http://localhost/api/app/v1/sessions", {
    method: "DELETE",
    headers,
  });
}

let errorLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
  signIn.checkCredentials.mockResolvedValue({ ok: true, coachId: "coach-1" });
  auth.createSession.mockResolvedValue({
    token: TOKEN,
    expiresAt: new Date("2027-03-25T00:00:00Z"),
  });
  auth.getApiSession.mockResolvedValue({
    publicId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    kind: "device",
    coach: { id: "coach-1", email: "coach@example.test", name: "Coach" },
  });
  auth.revokeSession.mockResolvedValue(true);
});

describe("POST /api/app/v1/sessions", () => {
  it("starts a named device session and hands out its token uncached", async () => {
    const response = await POST(post(BODY));

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ token: TOKEN });
    expect(signIn.checkCredentials).toHaveBeenCalledWith(
      "coach@example.test",
      "correct-password",
      "203.0.113.7",
    );
    expect(auth.createSession).toHaveBeenCalledWith("coach-1", {
      kind: "device",
      deviceName: "MacBook Pro von Alex",
    });
  });

  it("answers 401 for wrong credentials without starting a session", async () => {
    signIn.checkCredentials.mockResolvedValue({ ok: false, reason: "invalid" });

    const response = await POST(post(BODY));

    expect(response.status).toBe(401);
    expect(auth.createSession).not.toHaveBeenCalled();
  });

  it("answers 429 with Retry-After once the login rate limit is hit", async () => {
    signIn.checkCredentials.mockResolvedValue({
      ok: false,
      reason: "limited",
      retryAfterMs: 61_500,
    });

    const response = await POST(post(BODY));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("62");
  });

  it("answers 426 to an outdated build before reading the body", async () => {
    const response = await POST(post(BODY, "0.0.1"));

    expect(response.status).toBe(426);
    await expect(response.json()).resolves.toMatchObject({
      minVersion: MIN_APP_VERSION,
    });
    expect(signIn.checkCredentials).not.toHaveBeenCalled();
  });

  it("answers 400 without the version header", async () => {
    const response = await POST(post(BODY, null));

    expect(response.status).toBe(400);
    expect(signIn.checkCredentials).not.toHaveBeenCalled();
  });

  it("answers 400 to a malformed body", async () => {
    expect((await POST(post("{"))).status).toBe(400);
    expect((await POST(post({ ...BODY, deviceName: " " }))).status).toBe(400);
    expect((await POST(post({ ...BODY, password: 42 }))).status).toBe(400);
    expect(signIn.checkCredentials).not.toHaveBeenCalled();
  });

  it("keeps the password and token out of the log when a write fails", async () => {
    auth.createSession.mockRejectedValue(new Error("db down"));

    const response = await POST(post(BODY));

    expect(response.status).toBe(500);
    const logged = JSON.stringify(errorLog.mock.calls, (_key, value) =>
      value instanceof Error ? value.message : value,
    );
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain("correct-password");
    await expect(response.text()).resolves.not.toContain(TOKEN);
  });
});

describe("DELETE /api/app/v1/sessions", () => {
  it("signs the calling device out", async () => {
    const response = await DELETE(del());

    expect(response.status).toBe(204);
    expect(auth.revokeSession).toHaveBeenCalledWith(
      "coach-1",
      "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    );
  });

  it("answers 401 once the session is gone, e.g. removed under Geräte", async () => {
    auth.getApiSession.mockResolvedValue(null);

    const response = await DELETE(del());

    expect(response.status).toBe(401);
    expect(auth.revokeSession).not.toHaveBeenCalled();
  });

  it("refuses a browser's cookie session", async () => {
    auth.getApiSession.mockResolvedValue({
      publicId: "w",
      kind: "web",
      coach: { id: "coach-1", email: "coach@example.test", name: "Coach" },
    });

    expect((await DELETE(del())).status).toBe(401);
    expect(auth.revokeSession).not.toHaveBeenCalled();
  });

  it("answers 426 to an outdated build", async () => {
    expect((await DELETE(del("0.0.1"))).status).toBe(426);
    expect(auth.getApiSession).not.toHaveBeenCalled();
  });
});
