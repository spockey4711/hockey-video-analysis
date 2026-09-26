/**
 * Response helpers shared by the `/api/app/v1/*` route handlers. Every answer
 * is `no-store`: a sign-in response carries a token, and nothing the Mac reads
 * about the coach's account belongs in a cache.
 */
import { NextResponse } from "next/server";

import {
  APP_VERSION_HEADER,
  checkAppVersion,
  MIN_APP_VERSION,
} from "./version";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** A JSON answer that no cache keeps. */
export function appJson(
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return NextResponse.json(body, {
    status,
    headers: { ...NO_STORE, ...headers },
  });
}

/** An empty answer that no cache keeps. */
export function appEmpty(status: number): Response {
  return new Response(null, { status, headers: NO_STORE });
}

/** The answer to a request without a valid session. */
export function appUnauthorized(): Response {
  return appJson({ error: "unauthorized" }, 401);
}

/**
 * The version gate as a response: `null` lets the request through, otherwise
 * `400` for a missing or malformed header and `426` for a build older than the
 * API supports (naming the minimum, so the Mac can say which update it needs).
 */
export function appVersionGate(request: Request): Response | null {
  switch (checkAppVersion(request.headers.get(APP_VERSION_HEADER))) {
    case "ok":
      return null;
    case "missing":
      return appJson({ error: `missing ${APP_VERSION_HEADER} header` }, 400);
    case "outdated":
      return appJson(
        { error: "app update required", minVersion: MIN_APP_VERSION },
        426,
      );
  }
}
