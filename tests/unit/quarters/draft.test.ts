import { describe, expect, it } from "vitest";

import {
  draftProblem,
  initialDraft,
  toQuarters,
} from "@/features/quarters/draft";

describe("initialDraft", () => {
  it("builds four rows seeded from persisted quarters", () => {
    const draft = initialDraft(
      [
        { index: 1, startS: 0, endS: 600 },
        { index: 3, startS: 1200, endS: null },
      ],
      4,
    );
    expect(draft).toEqual([
      { index: 1, startS: 0, endS: 600 },
      { index: 2, startS: null, endS: null },
      { index: 3, startS: 1200, endS: null },
      { index: 4, startS: null, endS: null },
    ]);
  });

  it("builds one row per half for a game of two halves", () => {
    expect(initialDraft([{ index: 1, startS: 60, endS: 1260 }], 2)).toEqual([
      { index: 1, startS: 60, endS: 1260 },
      { index: 2, startS: null, endS: null },
    ]);
  });

  it("builds four empty rows when nothing is persisted yet", () => {
    expect(initialDraft([], 4).map((row) => row.startS)).toEqual([
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
    expect(toQuarters(initialDraft([], 4))).toEqual([]);
  });
});

describe("draftProblem", () => {
  const valid = initialDraft(
    [
      { index: 1, startS: 0, endS: 900 },
      { index: 2, startS: 1200, endS: 2100 },
      { index: 3, startS: 2400, endS: null },
    ],
    4,
  );

  it("accepts ordered quarters with breaks between them", () => {
    expect(draftProblem(valid)).toBeNull();
  });

  it("accepts an empty draft", () => {
    expect(draftProblem(initialDraft([], 4))).toBeNull();
  });

  it("flags a quarter marked while an earlier one is not", () => {
    const draft = initialDraft(
      [
        { index: 1, startS: 0, endS: null },
        { index: 3, startS: 2400, endS: null },
      ],
      4,
    );
    expect(draftProblem(draft)).toBe("gap");
  });

  it("flags an end at or before the quarter's own start", () => {
    const draft = initialDraft([{ index: 1, startS: 600, endS: 600 }], 4);
    expect(draftProblem(draft)).toBe("endBeforeStart");
  });

  it("flags a quarter starting before the previous one", () => {
    const draft = initialDraft(
      [
        { index: 1, startS: 1200, endS: null },
        { index: 2, startS: 600, endS: null },
      ],
      4,
    );
    expect(draftProblem(draft)).toBe("order");
  });

  it("flags a quarter starting before the previous quarter's end", () => {
    const draft = initialDraft(
      [
        { index: 1, startS: 0, endS: 1300 },
        { index: 2, startS: 1200, endS: null },
      ],
      4,
    );
    expect(draftProblem(draft)).toBe("overlap");
  });
});
