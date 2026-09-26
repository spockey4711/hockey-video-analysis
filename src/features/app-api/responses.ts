/**
 * Response helpers shared by the `/api/app/v1/*` route handlers. Every answer
 * is `no-store`: a sign-in response carries a token, and nothing the Mac reads
 * about the coach's account belongs in a cache. The `If-Match` helpers at the
 * end serve the older `/api/*` write routes the Mac calls too.
 */
import { NextResponse } from "next/server";

import { entityTag, IF_MATCH_HEADER, parseIfMatch } from "./if-match";
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

/**
 * The base version a write names in `If-Match` (ADR 0013): the version, `null`
 * when the request has no header (the web writes without the check), or the
 * `400` answering a header that names no single version.
 */
export function readBaseVersion(request: Request): number | null | Response {
  const ifMatch = parseIfMatch(request.headers.get(IF_MATCH_HEADER));
  if (!ifMatch.ok) {
    return NextResponse.json({ error: ifMatch.error }, { status: 400 });
  }
  return ifMatch.version;
}

/**
 * The `409` refusing a write whose base version the row has moved past. `body`
 * carries the row as it is now, so the Mac can merge it and retry; `version`
 * is that row's version, also sent as the `ETag`.
 */
export function versionConflict(
  body: Record<string, unknown>,
  version: number,
): Response {
  return NextResponse.json(
    { error: "version conflict", ...body },
    { status: 409, headers: { ETag: entityTag(version) } },
  );
}
