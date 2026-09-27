/**
 * Golden vectors for the quarter editor's draft: which rows of the editor
 * become the stored quarter set, and the first problem that blocks saving it.
 * Kept apart from `quarters.ts`, which pins the stored set and the rules on it,
 * and independent of the number of quarters a game has: every case passes its
 * rows explicitly.
 */
import { DEFAULT_TOLERANCE, vectorCase, type VectorFile } from "./vector";

import {
  draftProblem,
  toQuarters,
  type QuarterDraft,
} from "@/features/quarters/draft";

function row(
  index: number,
  startS: number | null,
  endS: number | null = null,
): QuarterDraft {
  return { index, startS, endS };
}

function quartersCase(name: string, draft: QuarterDraft[]) {
  return vectorCase(name, "toQuarters", { draft }, (i) => toQuarters(i.draft));
}

function problemCase(name: string, draft: QuarterDraft[]) {
  return vectorCase(name, "draftProblem", { draft }, (i) =>
    draftProblem(i.draft),
  );
}

export function buildQuarterDraft(): VectorFile {
  return {
    contract: "quarter-draft",
    description:
      "The quarter editor holds one row per quarter; a row without a start is " +
      "not marked yet. toQuarters keeps the marked rows in index order, the set " +
      "that is stored. draftProblem is the first reason the rows cannot be " +
      "saved, or null: gap (a quarter is marked while an earlier one is not), " +
      "endBeforeStart (an end at or before its own start), order (a start at or " +
      "before the previous start) or overlap (a start before the previous " +
      "quarter's marked end), checked quarter by quarter in index order.",
    reference: ["src/features/quarters/draft.ts"],
    tolerance: DEFAULT_TOLERANCE,
    cases: [
      quartersCase("marked rows in index order", [
        row(2, 1200, 2100),
        row(1, 120, 1020),
        row(3, null),
        row(4, null),
      ]),
      quartersCase("an unmarked row is dropped", [
        row(1, 60),
        row(2, null, 1900),
      ]),
      quartersCase("nothing marked", [row(1, null), row(2, null)]),

      problemCase("an empty draft", [row(1, null), row(2, null)]),
      problemCase("every quarter marked", [
        row(1, 120, 1020),
        row(2, 1200, 2100),
        row(3, 2700, 3600),
        row(4, 3780),
      ]),
      problemCase("only the first starts", [row(1, 60), row(2, null)]),
      problemCase("a later quarter without the earlier", [
        row(1, null),
        row(2, 1200),
      ]),
      problemCase("a gap between marked quarters", [
        row(1, 60),
        row(2, null),
        row(3, 2700),
      ]),
      problemCase("an end at its start", [row(1, 60, 60)]),
      problemCase("a start before the previous start", [
        row(1, 1200),
        row(2, 120),
      ]),
      problemCase("a start at the previous start", [row(1, 120), row(2, 120)]),
      problemCase("a start before the previous end", [
        row(1, 120, 1300),
        row(2, 1200),
      ]),
      problemCase("a start at the previous end", [
        row(1, 120, 1020),
        row(2, 1020),
      ]),
      problemCase("the first problem in index order wins", [
        row(2, 50, 40),
        row(1, 120, 100),
      ]),
    ],
  };
}
