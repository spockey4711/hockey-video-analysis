import { describe, expect, it } from "vitest";

import {
  deviceIcon,
  formatLastUsed,
  toDeviceRows,
} from "@/features/settings/devices/rows";
import type { SessionSummary } from "@/lib/auth";

const NOW = new Date("2026-09-26T12:00:00Z");
const HOUR = 60 * 60 * 1000;

function ago(ms: number): Date {
  return new Date(NOW.getTime() - ms);
}

function session(overrides: Partial<SessionSummary>): SessionSummary {
  return {
    publicId: "id",
    kind: "web",
    deviceName: "Chrome auf macOS",
    lastSeenAt: NOW,
    createdAt: ago(48 * HOUR),
    ...overrides,
  };
}

describe("formatLastUsed", () => {
  it("reads under an hour as the last hour, since the write is hourly", () => {
    expect(formatLastUsed(ago(59 * 60 * 1000), NOW)).toBe(
      "Zuletzt verwendet in der letzten Stunde",
    );
  });

  it("counts hours, then days", () => {
    expect(formatLastUsed(ago(1 * HOUR), NOW)).toBe(
      "Zuletzt verwendet vor 1 Stunde",
    );
    expect(formatLastUsed(ago(5 * HOUR), NOW)).toBe(
      "Zuletzt verwendet vor 5 Stunden",
    );
    expect(formatLastUsed(ago(30 * HOUR), NOW)).toBe(
      "Zuletzt verwendet gestern",
    );
    expect(formatLastUsed(ago(6 * 24 * HOUR), NOW)).toBe(
      "Zuletzt verwendet vor 6 Tagen",
    );
  });

  it("names the date after a month, in the coach's time zone", () => {
    expect(
      formatLastUsed(new Date("2026-08-01T23:30:00Z"), NOW, "Europe/Berlin"),
    ).toBe("Zuletzt verwendet am 2. August 2026");
  });
});

describe("deviceIcon", () => {
  it("picks a glyph for the Mac, phones, tablets and computers", () => {
    expect(deviceIcon("device", "MacBook Pro")).toBe("laptop");
    expect(deviceIcon("web", "Safari auf iPhone")).toBe("smartphone");
    expect(deviceIcon("web", "Chrome auf Android")).toBe("smartphone");
    expect(deviceIcon("web", "Safari auf iPad")).toBe("tablet");
    expect(deviceIcon("web", "Edge auf Windows")).toBe("monitor");
    expect(deviceIcon("web", null)).toBe("monitor");
  });
});

describe("toDeviceRows", () => {
  it("lists this browser first, marked, then the others by last use", () => {
    const rows = toDeviceRows(
      [
        session({ publicId: "mac", kind: "device", deviceName: "MacBook" }),
        session({
          publicId: "phone",
          deviceName: "Safari auf iPhone",
          lastSeenAt: ago(3 * HOUR),
        }),
        session({ publicId: "here", lastSeenAt: ago(2 * HOUR) }),
      ],
      "here",
      NOW,
    );

    expect(rows.map((row) => row.publicId)).toEqual(["here", "mac", "phone"]);
    expect(rows[0]).toMatchObject({
      current: true,
      name: "Chrome auf macOS",
      kindLabel: "Browser",
      lastUsed: "Gerade aktiv",
    });
    expect(rows[1]).toMatchObject({
      current: false,
      name: "MacBook",
      kindLabel: "Mac-App",
      icon: "laptop",
    });
    expect(rows[2]?.lastUsed).toBe("Zuletzt verwendet vor 3 Stunden");
  });

  it("names a session from before device names", () => {
    const [row] = toDeviceRows([session({ deviceName: null })], "x", NOW);
    expect(row?.name).toBe("Unbekanntes Gerät");
  });
});
