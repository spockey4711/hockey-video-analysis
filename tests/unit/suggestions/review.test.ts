import { describe, expect, it } from "vitest";

import {
  goalTagFromCandidate,
  SUGGESTION_TAG_TYPE,
} from "@/features/suggestions/review";

describe("goalTagFromCandidate", () => {
  it("commits a candidate to a goal tag with the goal default window", () => {
    // The frozen goal window is preS 10 / postS 5 (see tag-types config).
    expect(goalTagFromCandidate(100)).toEqual({
      type: SUGGESTION_TAG_TYPE,
      startS: 90,
      endS: 105,
    });
  });

  it("clamps the lead-in at the game start", () => {
    expect(goalTagFromCandidate(4)).toEqual({
      type: SUGGESTION_TAG_TYPE,
      startS: 0,
      endS: 9,
    });
  });

  it("clamps the window to the game duration when given", () => {
    expect(goalTagFromCandidate(250, { maxS: 200 })).toEqual({
      type: SUGGESTION_TAG_TYPE,
      startS: 190,
      endS: 200,
    });
  });

  it("rejects a non-finite or negative candidate time", () => {
    expect(() => goalTagFromCandidate(-1)).toThrow(RangeError);
    expect(() => goalTagFromCandidate(Number.NaN)).toThrow(RangeError);
  });
});
