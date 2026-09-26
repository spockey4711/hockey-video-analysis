import { beforeEach, describe, expect, it, vi } from "vitest";

// The Geräte actions against a mocked session store: what matters is that a
// coach only ever reaches their own sessions, and that their own row logs out.
const auth = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  revokeSession: vi.fn(),
  revokeOtherSessions: vi.fn(),
}));
const access = vi.hoisted(() => ({ logoutAction: vi.fn() }));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/features/access/actions", () => access);
vi.mock("next/cache", () => cache);

import { settingsContent } from "@/features/settings/content";
import {
  signOutDeviceAction,
  signOutOtherDevicesAction,
} from "@/features/settings/devices/actions";

const HERE = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const MAC = "3f2504e0-4f89-41d3-9a0c-0305e82c3302";
const SESSION = {
  publicId: HERE,
  kind: "web",
  coach: { id: "coach-1", email: "coach@example.test", name: "Coach" },
};
const IDLE = { status: "idle" } as const;

function form(publicId: string): FormData {
  const data = new FormData();
  data.set("publicId", publicId);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  auth.getCurrentSession.mockResolvedValue(SESSION);
  auth.revokeSession.mockResolvedValue(true);
  auth.revokeOtherSessions.mockResolvedValue(2);
});

describe("signOutDeviceAction", () => {
  it("signs another device out within the coach's sessions", async () => {
    await expect(signOutDeviceAction(IDLE, form(MAC))).resolves.toEqual({
      status: "success",
    });
    expect(auth.revokeSession).toHaveBeenCalledWith("coach-1", MAC);
    expect(cache.revalidatePath).toHaveBeenCalledWith("/settings");
    expect(access.logoutAction).not.toHaveBeenCalled();
  });

  it("logs out when the coach picks this browser's own row", async () => {
    await signOutDeviceAction(IDLE, form(HERE));

    expect(access.logoutAction).toHaveBeenCalledTimes(1);
    expect(auth.revokeSession).not.toHaveBeenCalled();
  });

  it("refuses a malformed id before any query", async () => {
    const result = await signOutDeviceAction(IDLE, form("../etc"));

    expect(result).toEqual({
      status: "error",
      error: settingsContent.devices.errors.invalidId,
    });
    expect(auth.revokeSession).not.toHaveBeenCalled();
  });

  it("refuses without a signed-in browser", async () => {
    auth.getCurrentSession.mockResolvedValue(null);

    const result = await signOutDeviceAction(IDLE, form(MAC));

    expect(result).toEqual({
      status: "error",
      error: settingsContent.errors.notSignedIn,
    });
    expect(auth.revokeSession).not.toHaveBeenCalled();
  });

  it("reports a failed delete", async () => {
    auth.revokeSession.mockRejectedValue(new Error("db down"));

    await expect(signOutDeviceAction(IDLE, form(MAC))).resolves.toEqual({
      status: "error",
      error: settingsContent.devices.errors.unexpected,
    });
  });
});

describe("signOutOtherDevicesAction", () => {
  it("signs out every session but this browser's", async () => {
    await expect(signOutOtherDevicesAction()).resolves.toEqual({
      status: "success",
    });
    expect(auth.revokeOtherSessions).toHaveBeenCalledWith("coach-1", HERE);
    expect(cache.revalidatePath).toHaveBeenCalledWith("/settings");
  });

  it("refuses without a signed-in browser", async () => {
    auth.getCurrentSession.mockResolvedValue(null);

    await expect(signOutOtherDevicesAction()).resolves.toMatchObject({
      status: "error",
    });
    expect(auth.revokeOtherSessions).not.toHaveBeenCalled();
  });
});
