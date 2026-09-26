"use server";

import { revalidatePath } from "next/cache";

import { settingsContent } from "../content";

import type { DeviceActionState } from "./state";

import { logoutAction } from "@/features/access/actions";
import {
  getCurrentSession,
  revokeOtherSessions,
  revokeSession,
} from "@/lib/auth";

const { devices, errors } = settingsContent;

const SETTINGS_PATH = "/settings";

// The public handle is a Postgres uuid; anything else cannot name a session.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Sign one of the coach's devices out (Einstellungen > Geräte). The session is
 * deleted, so the device is refused on its very next request. Choosing this
 * browser's own row is a plain logout.
 */
export async function signOutDeviceAction(
  _prev: DeviceActionState,
  formData: FormData,
): Promise<DeviceActionState> {
  const session = await getCurrentSession();
  if (!session) return { status: "error", error: errors.notSignedIn };

  const publicId = formData.get("publicId");
  if (typeof publicId !== "string" || !UUID.test(publicId)) {
    return { status: "error", error: devices.errors.invalidId };
  }
  if (publicId === session.publicId) {
    // Clears the cookie and redirects to the login page; never returns.
    await logoutAction();
    return { status: "success" };
  }

  try {
    await revokeSession(session.coach.id, publicId);
  } catch (cause) {
    console.error("failed to sign a device out", cause);
    return { status: "error", error: devices.errors.unexpected };
  }
  // Gone already (signed out elsewhere) is the outcome the coach wanted too.
  revalidatePath(SETTINGS_PATH);
  return { status: "success" };
}

/** Sign out every device of the coach but this browser, the Mac included. */
export async function signOutOtherDevicesAction(): Promise<DeviceActionState> {
  const session = await getCurrentSession();
  if (!session) return { status: "error", error: errors.notSignedIn };

  try {
    await revokeOtherSessions(session.coach.id, session.publicId);
  } catch (cause) {
    console.error("failed to sign the other devices out", cause);
    return { status: "error", error: devices.errors.unexpected };
  }
  revalidatePath(SETTINGS_PATH);
  return { status: "success" };
}
