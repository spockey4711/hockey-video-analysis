/**
 * Server-side authorization guard for coach-only surfaces. Middleware provides a
 * coarse cookie-presence redirect at the edge; this is the authoritative check
 * (it validates the session against the database) that pages and route handlers
 * call before rendering or mutating protected content.
 */
import "server-only";
import { redirect } from "next/navigation";

import {
  getCurrentCoach,
  LOGIN_PATH,
  NEXT_PARAM,
  type SessionCoach,
} from "@/lib/auth";

/**
 * Return the signed-in coach, or redirect to the login page (optionally
 * remembering `returnTo`) when there is no valid session.
 */
export async function requireCoach(returnTo?: string): Promise<SessionCoach> {
  const coach = await getCurrentCoach();
  if (coach) return coach;
  const target = returnTo
    ? `${LOGIN_PATH}?${NEXT_PARAM}=${encodeURIComponent(returnTo)}`
    : LOGIN_PATH;
  redirect(target);
}
