/**
 * Edge middleware that gates coach-only surfaces. It runs on the edge runtime,
 * which cannot reach Postgres, so it only checks for the *presence* of the
 * session cookie and redirects to login when it is missing - a fast UX guard and
 * defense in depth. The authoritative check (validating the session against the
 * database) is `requireCoach()` in the server components/actions that render or
 * mutate protected content.
 *
 * Everything is protected by default; the public allowlist below is the landing
 * page, the auth screens, the login-free share links, and the legal pages
 * (Impressum, Datenschutz), which must be readable without an account.
 */
import { NextResponse, type NextRequest } from "next/server";

import { IMPRESSUM_PATH, PRIVACY_PATH } from "@/features/legal/routes";
import { LOGIN_PATH, NEXT_PARAM, SESSION_COOKIE_NAME } from "@/lib/auth/config";

const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/share",
  IMPRESSUM_PATH,
  PRIVACY_PATH,
];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname) || request.cookies.has(SESSION_COOKIE_NAME)) {
    return NextResponse.next();
  }

  const loginUrl = new URL(LOGIN_PATH, request.url);
  loginUrl.searchParams.set(NEXT_PARAM, `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

// Run on page navigations only: skip API routes (they guard themselves), Next
// internals, and any path with a file extension (static assets).
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
