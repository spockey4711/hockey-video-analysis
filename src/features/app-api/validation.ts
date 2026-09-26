/**
 * Parse functions for the Mac app's request bodies - pure, so the rules are
 * unit-tested without a request. Error strings are for the Mac's logs; the Mac
 * shows its own copy to the coach.
 */
import { cleanDeviceName } from "@/features/access/device-label";
import { normalizeEmail } from "@/features/access/validation";

/** A device sign-in: the coach's credentials and the name the Mac goes by. */
export interface DeviceSignIn {
  email: string;
  password: string;
  deviceName: string;
}

export type ParseResult<T> =
  { ok: true; value: T } | { ok: false; error: string };

// Longer than any real value; a bound on what reaches scrypt and the database.
const EMAIL_MAX_LENGTH = 320;
const PASSWORD_MAX_LENGTH = 200;

/** Validate `POST /api/app/v1/sessions`'s body. */
export function parseDeviceSignIn(raw: unknown): ParseResult<DeviceSignIn> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "body must be a JSON object" };
  }
  const { email, password, deviceName } = raw as Record<string, unknown>;
  if (typeof email !== "string" || typeof password !== "string") {
    return { ok: false, error: "email and password are required" };
  }
  if (typeof deviceName !== "string") {
    return { ok: false, error: "deviceName is required" };
  }
  const normalized = normalizeEmail(email);
  if (
    !normalized ||
    !password ||
    normalized.length > EMAIL_MAX_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    return { ok: false, error: "email and password are required" };
  }
  const name = cleanDeviceName(deviceName);
  if (!name) return { ok: false, error: "deviceName is required" };
  return { ok: true, value: { email: normalized, password, deviceName: name } };
}
