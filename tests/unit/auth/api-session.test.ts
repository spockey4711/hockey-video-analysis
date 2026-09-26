import { beforeEach, describe, expect, it, vi } from "vitest";

// Both transports end in a session lookup; the stand-ins record which one ran
// and with which kind, so the test pins what a route handler may accept.
const auth = vi.hoisted(() => ({
  validateSessionToken: vi.fn(),
  getCurrentSession: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  validateSessionToken: auth.validateSessionToken,
}));
vi.mock("@/lib/auth/current-coach", () => ({
  getCurrentSession: auth.getCurrentSession,
}));

import {
  getApiSession,
  isApiPath,
  readBearerToken,
} from "@/lib/auth/api-session";

const TOKEN = "0123456789abcdef".repeat(4);
const DEVICE = { publicId: "d", kind: "device" };
const WEB = { publicId: "w", kind: "web" };

function request(path: string, authorization?: string): Request {
  const headers = new Headers();
  if (authorization !== undefined) headers.set("authorization", authorization);
  return new Request(`http://localhost${path}`, { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.validateSessionToken.mockResolvedValue(DEVICE);
  auth.getCurrentSession.mockResolvedValue(WEB);
});

describe("readBearerToken", () => {
  it("reads a well-formed bearer token", () => {
    expect(readBearerToken(`Bearer ${TOKEN}`)).toBe(TOKEN);
  });

  it("tells a missing header from a malformed one", () => {
    expect(readBearerToken(null)).toBeUndefined();
    expect(readBearerToken("Basic dXNlcjpwYXNz")).toBeNull();
    expect(readBearerToken("Bearer ")).toBeNull();
    expect(readBearerToken(`Bearer ${TOKEN.toUpperCase()}`)).toBeNull();
    expect(readBearerToken(`Bearer ${TOKEN}0`)).toBeNull();
  });
});

describe("isApiPath", () => {
  it("counts route handler paths only", () => {
    expect(isApiPath("/api/app/v1/sessions")).toBe(true);
    expect(isApiPath("/api")).toBe(false);
    expect(isApiPath("/settings")).toBe(false);
    expect(isApiPath("/apis/x")).toBe(false);
  });
});

describe("getApiSession", () => {
  it("accepts a device bearer token on an API path", async () => {
    await expect(
      getApiSession(request("/api/app/v1/sessions", `Bearer ${TOKEN}`)),
    ).resolves.toBe(DEVICE);
    expect(auth.validateSessionToken).toHaveBeenCalledWith(TOKEN, "device");
    expect(auth.getCurrentSession).not.toHaveBeenCalled();
  });

  it("refuses a bearer token outside the API", async () => {
    await expect(
      getApiSession(request("/settings", `Bearer ${TOKEN}`)),
    ).resolves.toBeNull();
    expect(auth.validateSessionToken).not.toHaveBeenCalled();
  });

  it("refuses a malformed header without falling back to the cookie", async () => {
    await expect(
      getApiSession(request("/api/tags", "Bearer nope")),
    ).resolves.toBeNull();
    expect(auth.validateSessionToken).not.toHaveBeenCalled();
    expect(auth.getCurrentSession).not.toHaveBeenCalled();
  });

  it("uses the browser's cookie session when no header is sent", async () => {
    await expect(getApiSession(request("/api/tags"))).resolves.toBe(WEB);
    expect(auth.validateSessionToken).not.toHaveBeenCalled();
  });
});
