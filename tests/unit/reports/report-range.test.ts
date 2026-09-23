import { describe, expect, it } from "vitest";

import {
  isRangeSet,
  parseReportRange,
  reportRangeQuery,
} from "@/features/reports/report-range";

describe("parseReportRange", () => {
  it("reads both ends", () => {
    expect(parseReportRange({ from: "2026-01-01", to: "2026-03-31" })).toEqual({
      from: "2026-01-01",
      to: "2026-03-31",
    });
  });

  it("leaves missing, malformed and impossible dates open", () => {
    expect(parseReportRange({})).toEqual({ from: null, to: null });
    expect(parseReportRange({ from: "", to: "31.03.2026" })).toEqual({
      from: null,
      to: null,
    });
    expect(parseReportRange({ from: "2026-02-30", to: "2026-13-01" })).toEqual({
      from: null,
      to: null,
    });
  });

  it("ignores a repeated parameter", () => {
    expect(
      parseReportRange({
        from: ["2026-01-01", "2026-02-01"],
        to: "2026-03-01",
      }),
    ).toEqual({ from: null, to: "2026-03-01" });
  });

  it("swaps a reversed range", () => {
    expect(parseReportRange({ from: "2026-03-31", to: "2026-01-01" })).toEqual({
      from: "2026-01-01",
      to: "2026-03-31",
    });
  });

  it("accepts a leap day", () => {
    expect(parseReportRange({ from: "2028-02-29" }).from).toBe("2028-02-29");
  });
});

describe("isRangeSet", () => {
  it("is true when either end is set", () => {
    expect(isRangeSet({ from: null, to: null })).toBe(false);
    expect(isRangeSet({ from: "2026-01-01", to: null })).toBe(true);
    expect(isRangeSet({ from: null, to: "2026-01-01" })).toBe(true);
  });
});

describe("reportRangeQuery", () => {
  it("writes only the set ends", () => {
    expect(reportRangeQuery({ from: null, to: null })).toBe("");
    expect(reportRangeQuery({ from: "2026-01-01", to: null })).toBe(
      "?from=2026-01-01",
    );
    expect(reportRangeQuery({ from: "2026-01-01", to: "2026-03-31" })).toBe(
      "?from=2026-01-01&to=2026-03-31",
    );
  });
});
