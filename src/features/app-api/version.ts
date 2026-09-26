/**
 * The app version gate of the Mac app's API (ADR 0013). Every request to
 * `/api/app/v1/*` names its build in `X-HVA-App-Version`; a build older than
 * `MIN_APP_VERSION` is answered `426` so the Mac can ask the coach to update
 * instead of misreading a changed API. Raise the constant when the API breaks.
 */

/** The request header carrying the Mac app's version (`major.minor.patch`). */
export const APP_VERSION_HEADER = "X-HVA-App-Version";

/** The oldest Mac app build the API still serves. */
export const MIN_APP_VERSION = "0.1.0";

/** A parsed `major.minor.patch` version. */
export type AppVersion = readonly [number, number, number];

// Plain numeric triples only, as the Mac's CFBundleShortVersionString; no
// leading zeros and a sane length so a hostile header parses to nothing.
const VERSION = /^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/;

/** Parse a version header value, or `null` when it is missing or malformed. */
export function parseAppVersion(raw: string | null): AppVersion | null {
  const match = VERSION.exec(raw?.trim() ?? "");
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Negative, zero or positive as `a` is older than, equal to or newer than `b`. */
export function compareAppVersions(a: AppVersion, b: AppVersion): number {
  for (let part = 0; part < 3; part += 1) {
    const diff = a[part] - b[part];
    if (diff !== 0) return diff;
  }
  return 0;
}

/** What the gate decided about a request's version header. */
export type AppVersionCheck = "ok" | "missing" | "outdated";

/** Check a version header value against `MIN_APP_VERSION`. */
export function checkAppVersion(raw: string | null): AppVersionCheck {
  const version = parseAppVersion(raw);
  if (!version) return "missing";
  const minimum = parseAppVersion(MIN_APP_VERSION);
  if (minimum && compareAppVersions(version, minimum) < 0) return "outdated";
  return "ok";
}
