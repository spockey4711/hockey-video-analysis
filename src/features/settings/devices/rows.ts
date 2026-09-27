/**
 * The Geräte list as plain rows: which session is this browser, what each is
 * called, which glyph fits it and when it was last used. Pure, so the rules are
 * unit-tested without a database or a render.
 */
import { settingsContent } from "../content";

import type { IconName } from "@/components/core/Icon";
import type { SessionSummary } from "@/lib/auth";

const { devices } = settingsContent;

/** Where the coach reads dates; the server itself may run in UTC. */
export const DEVICES_TIME_ZONE = "Europe/Berlin";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
// Past this, a relative "vor 40 Tagen" reads worse than the date itself.
const RELATIVE_DAYS = 30;

const RELATIVE = new Intl.RelativeTimeFormat("de-DE", { numeric: "auto" });

/** One row of the Geräte list. */
export interface DeviceRow {
  publicId: string;
  name: string;
  /** "Browser" or "Mac-App". */
  kindLabel: string;
  icon: IconName;
  /** True for the session of the browser viewing the page. */
  current: boolean;
  /** "Gerade aktiv" for this browser, otherwise "Zuletzt verwendet ...". */
  lastUsed: string;
}

/**
 * When a session was last used, in words. `last_seen_at` is only written once
 * an hour, so anything under an hour reads as "in der letzten Stunde".
 */
export function formatLastUsed(
  lastSeenAt: Date,
  now: Date,
  timeZone: string = DEVICES_TIME_ZONE,
): string {
  const ago = Math.max(0, now.getTime() - lastSeenAt.getTime());
  let when: string;
  if (ago < HOUR_MS) {
    when = devices.withinTheHour;
  } else if (ago < DAY_MS) {
    when = RELATIVE.format(-Math.floor(ago / HOUR_MS), "hour");
  } else if (ago < RELATIVE_DAYS * DAY_MS) {
    when = RELATIVE.format(-Math.floor(ago / DAY_MS), "day");
  } else {
    const date = new Intl.DateTimeFormat("de-DE", {
      dateStyle: "long",
      timeZone,
    }).format(lastSeenAt);
    when = devices.onDate(date);
  }
  return devices.lastUsed(when);
}

/** The glyph for a session: the Mac, a phone, a tablet or a computer. */
export function deviceIcon(
  kind: SessionSummary["kind"],
  name: string | null,
): IconName {
  if (kind === "device") return "laptop";
  if (name && /\b(?:iPhone|Android)\b/.test(name)) return "smartphone";
  if (name && /\biPad\b/.test(name)) return "tablet";
  return "monitor";
}

/**
 * The rows of the Geräte list: this browser first, then the others as the
 * query ordered them (most recently used first).
 */
export function toDeviceRows(
  sessions: readonly SessionSummary[],
  currentPublicId: string,
  now: Date,
  timeZone: string = DEVICES_TIME_ZONE,
): DeviceRow[] {
  const rows = sessions.map((session): DeviceRow => {
    const current = session.publicId === currentPublicId;
    return {
      publicId: session.publicId,
      name: session.deviceName ?? devices.unknownName,
      kindLabel: devices.kinds[session.kind],
      icon: deviceIcon(session.kind, session.deviceName),
      current,
      lastUsed: current
        ? devices.activeNow
        : formatLastUsed(session.lastSeenAt, now, timeZone),
    };
  });
  return [
    ...rows.filter((row) => row.current),
    ...rows.filter((row) => !row.current),
  ];
}
