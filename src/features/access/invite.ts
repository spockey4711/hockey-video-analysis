/**
 * Invite-code gating for self-registration. Signup is disabled unless
 * `AUTH_INVITE_CODE` is set in the environment; a coach must then present the
 * matching code. This keeps the login-capable app self-hostable without opening
 * coach access to any visitor (the secure default is "signup off").
 */
import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Whether self-registration is available (an invite code is configured). */
export function isSignupEnabled(): boolean {
  return Boolean(process.env.AUTH_INVITE_CODE);
}

/**
 * Constant-time check of a submitted invite code against the configured one.
 * Returns `false` when signup is disabled or the code does not match.
 */
export function verifyInviteCode(submitted: string): boolean {
  const expected = process.env.AUTH_INVITE_CODE;
  if (!expected) return false;
  const a = Buffer.from(submitted);
  const b = Buffer.from(expected);
  // timingSafeEqual requires equal-length buffers; unequal length is a mismatch.
  return a.length === b.length && timingSafeEqual(a, b);
}
