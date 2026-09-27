import { describe, expect, it } from "vitest";

import {
  formatShareEndDate,
  isShareExpired,
  parseShareEndDate,
  shareEndDate,
  shareExpiryInstant,
  zonedDate,
} from "@/features/share/collections/expiry";

// Noon in Berlin on 2026-10-12 (CEST, UTC+2).
const NOW = new Date("2026-10-12T10:00:00Z");

describe("shareExpiryInstant", () => {
  it("ends the link at the midnight after the day, in Berlin summer time", () => {
    expect(shareExpiryInstant("2026-07-01").toISOString()).toBe(
      "2026-07-01T22:00:00.000Z",
    );
  });

  it("uses Berlin winter time outside daylight saving", () => {
    expect(shareExpiryInstant("2026-12-24").toISOString()).toBe(
      "2026-12-24T23:00:00.000Z",
    );
  });

  it("gets the days around the clock changes right", () => {
    // Clocks go forward on 2026-03-29 and back on 2026-10-25.
    expect(shareExpiryInstant("2026-03-28").toISOString()).toBe(
      "2026-03-28T23:00:00.000Z",
    );
    expect(shareExpiryInstant("2026-03-29").toISOString()).toBe(
      "2026-03-29T22:00:00.000Z",
    );
    expect(shareExpiryInstant("2026-10-24").toISOString()).toBe(
      "2026-10-24T22:00:00.000Z",
    );
    expect(shareExpiryInstant("2026-10-25").toISOString()).toBe(
      "2026-10-25T23:00:00.000Z",
    );
  });

  it("gives back the picked day as the last day the link works", () => {
    for (const day of ["2026-03-29", "2026-10-25", "2026-12-31"]) {
      expect(shareEndDate(shareExpiryInstant(day))).toBe(day);
    }
  });
});

describe("isShareExpired", () => {
  const end = shareExpiryInstant("2026-10-12");

  it("keeps a link without an end date valid", () => {
    expect(isShareExpired(null, NOW)).toBe(false);
  });

  it("keeps the link valid through the whole end day", () => {
    expect(isShareExpired(end, NOW)).toBe(false);
    expect(isShareExpired(end, new Date(end.getTime() - 1))).toBe(false);
  });

  it("expires the link from the midnight after the end day", () => {
    expect(isShareExpired(end, end)).toBe(true);
    expect(isShareExpired(end, new Date(end.getTime() + 60_000))).toBe(true);
  });
});

describe("parseShareEndDate", () => {
  it("removes the end date for an empty field", () => {
    expect(parseShareEndDate("", NOW)).toEqual({ ok: true, value: null });
    expect(parseShareEndDate("  ", NOW)).toEqual({ ok: true, value: null });
  });

  it("accepts today and later days", () => {
    expect(parseShareEndDate("2026-10-12", NOW)).toEqual({
      ok: true,
      value: shareExpiryInstant("2026-10-12"),
    });
    expect(parseShareEndDate("2027-01-31", NOW)).toEqual({
      ok: true,
      value: shareExpiryInstant("2027-01-31"),
    });
  });

  it("refuses a day before today in Berlin", () => {
    expect(parseShareEndDate("2026-10-11", NOW)).toEqual({
      ok: false,
      problem: "past",
    });
    // 23:30 UTC is already the next day in Berlin.
    expect(
      parseShareEndDate("2026-10-12", new Date("2026-10-12T23:30:00Z")),
    ).toEqual({ ok: false, problem: "past" });
  });

  it("refuses what is not a real calendar day", () => {
    for (const input of ["2026-02-30", "2026-13-01", "12.10.2026", "x", 5]) {
      expect(parseShareEndDate(input, NOW)).toEqual({
        ok: false,
        problem: "invalid",
      });
    }
    expect(parseShareEndDate(null, NOW)).toEqual({
      ok: false,
      problem: "invalid",
    });
  });
});

describe("display helpers", () => {
  it("reads the calendar day in Berlin", () => {
    expect(zonedDate(new Date("2026-10-12T22:30:00Z"))).toBe("2026-10-13");
  });

  it("formats a day the German way", () => {
    expect(formatShareEndDate("2026-10-12")).toBe("12.10.2026");
  });
});
