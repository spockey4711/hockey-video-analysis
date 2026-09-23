import { describe, expect, it } from "vitest";

import { activeRailHref } from "@/components/watch/rail-active";

const HREFS = ["/games", "/games/g1/watch", "/games/g1/report", "/collections"];

describe("activeRailHref", () => {
  it("marks only the most specific section of a nested route", () => {
    expect(activeRailHref(HREFS, "/games/g1/watch")).toBe("/games/g1/watch");
    expect(activeRailHref(HREFS, "/games/g1/report")).toBe("/games/g1/report");
  });

  it("falls back to the containing section", () => {
    expect(activeRailHref(HREFS, "/games")).toBe("/games");
    expect(activeRailHref(HREFS, "/games/g2/watch")).toBe("/games");
  });

  it("returns null when no item contains the pathname", () => {
    expect(activeRailHref(HREFS, "/players")).toBeNull();
  });
});
