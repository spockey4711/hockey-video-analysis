/**
 * The two halves of every sign-in, shared by the web login form and the Mac
 * app's `POST /api/app/v1/sessions`: checking email and password under one rate
 * limit, and starting a browser session labelled with its device.
 */
import "server-only";
import { headers } from "next/headers";

import { deviceLabelFromUserAgent } from "./device-label";
import { findCoachByEmail } from "./queries";
import { checkRateLimit, recordFailure, reset } from "./rate-limit";

import {
  createSession,
  hashPassword,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";

/** The outcome of an email and password check. */
export type CredentialCheck =
  | { ok: true; coachId: string }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "limited"; retryAfterMs: number };

/** The client address a request came from, as the reverse proxy reports it. */
export function clientIp(requestHeaders: Headers): string {
  const forwarded = requestHeaders.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

/**
 * Check a normalized email and password. Failures are counted per client
 * address and email, the same bucket for the browser and the Mac, so switching
 * transport buys a guesser nothing. The answer never tells a wrong password
 * from a missing account.
 */
export async function checkCredentials(
  email: string,
  password: string,
  ip: string,
): Promise<CredentialCheck> {
  const key = `${ip}:${email}`;
  const limit = checkRateLimit(key);
  if (limit.limited) {
    return { ok: false, reason: "limited", retryAfterMs: limit.retryAfterMs };
  }

  const coach = await findCoachByEmail(email);
  // Verify against a real hash even when the account is missing, so the response
  // time does not reveal whether the email exists (no user enumeration).
  const ok = coach
    ? await verifyPassword(password, coach.passwordHash)
    : await verifyPassword(password, await dummyHash());

  if (!coach || !ok) {
    recordFailure(key);
    return { ok: false, reason: "invalid" };
  }

  reset(key);
  return { ok: true, coachId: coach.id };
}

/**
 * Start a web session for this browser and set its cookie. The session is
 * listed under Einstellungen > Geräte by a coarse label of the user agent.
 */
export async function startWebSession(coachId: string): Promise<void> {
  const store = await headers();
  const { token, expiresAt } = await createSession(coachId, {
    kind: "web",
    deviceName: deviceLabelFromUserAgent(store.get("user-agent")),
  });
  await setSessionCookie(token, expiresAt);
}

// A real scrypt hash of a random secret, computed once and reused only to
// equalize login timing when the account is missing. It never matches input.
let dummyHashCache: Promise<string> | null = null;
function dummyHash(): Promise<string> {
  dummyHashCache ??= hashPassword(crypto.randomUUID());
  return dummyHashCache;
}
