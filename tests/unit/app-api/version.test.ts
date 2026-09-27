import { describe, expect, it } from "vitest";

import {
  checkAppVersion,
  compareAppVersions,
  MIN_APP_VERSION,
  parseAppVersion,
} from "@/features/app-api/version";

describe("parseAppVersion", () => {
  it("parses a major.minor.patch version", () => {
    expect(parseAppVersion("1.12.3")).toEqual([1, 12, 3]);
    expect(parseAppVersion(" 0.1.0 ")).toEqual([0, 1, 0]);
  });

  it("refuses anything else", () => {
    for (const raw of [
      null,
      "",
      "1.2",
      "1.2.3.4",
      "v1.2.3",
      "01.2.3",
      "1.2.x",
    ]) {
      expect(parseAppVersion(raw)).toBeNull();
    }
    expect(parseAppVersion("1234567.0.0")).toBeNull();
  });
});

describe("compareAppVersions", () => {
  it("orders by major, then minor, then patch", () => {
    expect(compareAppVersions([1, 0, 0], [0, 9, 9])).toBeGreaterThan(0);
    expect(compareAppVersions([0, 2, 0], [0, 10, 0])).toBeLessThan(0);
    expect(compareAppVersions([0, 1, 1], [0, 1, 0])).toBeGreaterThan(0);
    expect(compareAppVersions([0, 1, 0], [0, 1, 0])).toBe(0);
  });
});

describe("checkAppVersion", () => {
  it("lets the minimum and newer builds through", () => {
    expect(checkAppVersion(MIN_APP_VERSION)).toBe("ok");
    expect(checkAppVersion("99.0.0")).toBe("ok");
  });

  it("flags older builds and missing headers", () => {
    expect(checkAppVersion("0.0.9")).toBe("outdated");
    expect(checkAppVersion(null)).toBe("missing");
    expect(checkAppVersion("latest")).toBe("missing");
  });
});
