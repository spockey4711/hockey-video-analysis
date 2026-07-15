/**
 * Read and write the session cookie. The cookie is HttpOnly (invisible to
 * client JS), SameSite=Lax (survives top-level navigation from share links but
 * not cross-site POSTs), and Secure in production. Cookie writes are only valid
 * in Server Actions and Route Handlers, so login/logout live there - never in a
 * plain Server Component render.
 */
import "server-only";
import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME } from "./config";

/** Persist the raw session token in the browser until `expiresAt`. */
export async function setSessionCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Read the raw session token from the request, or `null` if absent. */
export async function getSessionCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value ?? null;
}

/** Remove the session cookie (logout). */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}
