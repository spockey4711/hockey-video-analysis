import { describe, expect, it } from "vitest";

import { initialDraft, toQuarters } from "@/features/quarters/draft";

describe("initialDraft", () => {
  it("builds four rows seeded from persisted quarters", () => {
    const draft = initialDraft([
      { index: 1, startS: 0, endS: 600 },
      { index: 3, startS: 1200, endS: null },
    ]);
    expect(draft).toEqual([
      { index: 1, startS: 0, endS: 600 },
      { index: 2, startS: null, endS: null },
      { index: 3, startS: 1200, endS: null },
      { index: 4, startS: null, endS: null },
    ]);
  });

  it("builds four empty rows when nothing is persisted yet", () => {
    expect(initialDraft([]).map((row) => row.startS)).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });
});

describe("toQuarters", () => {
  it("keeps only marked rows, ordered by index", () => {
    const draft = [
      { index: 2, startS: 600, endS: null },
      { index: 1, startS: 0, endS: 600 },
      { index: 3, startS: null, endS: null },
      { index: 4, startS: null, endS: null },
    ];
    expect(toQuarters(draft)).toEqual([
      { index: 1, startS: 0, endS: 600 },
      { index: 2, startS: 600, endS: null },
    ]);
  });

  it("returns an empty set when no row is marked", () => {
    expect(toQuarters(initialDraft([]))).toEqual([]);
  });
});
