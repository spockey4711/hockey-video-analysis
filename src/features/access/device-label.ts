/**
 * Coarse device labels for sessions, shown under Einstellungen > Geräte. A
 * browser session keeps only its browser family and system ("Safari auf
 * iPhone"), derived from the user agent at sign-in; the full user agent is
 * never stored. The Mac app names itself, and that name is cleaned here too.
 * Pure, so the rules are unit-tested without a request.
 */
import { accessContent } from "./content";

const { device } = accessContent;

// Order matters: Edge, Opera and Samsung Internet also say "Chrome", Chrome
// also says "Safari", and every iOS browser says "Safari".
const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/\bEdg(?:e|A|iOS)?\//, "Edge"],
  [/\bOPR\/|\bOpera\b/, "Opera"],
  [/\bSamsungBrowser\//, "Samsung Internet"],
  [/\bFirefox\/|\bFxiOS\//, "Firefox"],
  [/\bCriOS\/|\bChrome\/|\bChromium\//, "Chrome"],
  [/\bSafari\//, "Safari"],
];

// iPhone and iPad before macOS: their user agents say "like Mac OS X".
const SYSTEMS: readonly (readonly [RegExp, string])[] = [
  [/\biPhone\b/, "iPhone"],
  [/\biPad\b/, "iPad"],
  [/\bAndroid\b/, "Android"],
  [/\bCrOS\b/, "ChromeOS"],
  [/\bWindows\b/, "Windows"],
  [/\bMacintosh\b|\bMac OS X\b/, "macOS"],
  [/\bLinux\b/, "Linux"],
];

// Real user agents stay well under this; the cap bounds the regex work on a
// hostile header.
const USER_AGENT_MAX_LENGTH = 512;

/** The longest device name the Mac may send, in characters. */
export const DEVICE_NAME_MAX_LENGTH = 60;

function firstMatch(
  table: readonly (readonly [RegExp, string])[],
  text: string,
): string | null {
  return table.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

/** "Chrome auf macOS" for a user agent, or a generic label when unknown. */
export function deviceLabelFromUserAgent(userAgent: string | null): string {
  const text = (userAgent ?? "").slice(0, USER_AGENT_MAX_LENGTH);
  const browser = firstMatch(BROWSERS, text);
  const system = firstMatch(SYSTEMS, text);
  if (!system) return browser ?? device.unknownDevice;
  return `${browser ?? device.unknownBrowser} ${device.on} ${system}`;
}

/**
 * The device name the Mac sent, cleaned for display: control characters
 * dropped, whitespace collapsed, cut to `DEVICE_NAME_MAX_LENGTH`. `null` when
 * nothing printable is left.
 */
export function cleanDeviceName(raw: string): string | null {
  const cleaned = Array.from(
    raw
      // Control and format characters (zero-width, bidi overrides) and line
      // separators would garble or disguise the name in the list.
      .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, " ")
      .replace(/\s+/g, " ")
      .trim(),
  )
    .slice(0, DEVICE_NAME_MAX_LENGTH)
    .join("")
    .trim();
  return cleaned || null;
}
