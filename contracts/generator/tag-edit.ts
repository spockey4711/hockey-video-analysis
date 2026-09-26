/**
 * Golden vectors for editing a tag's clip window: the end a window is cut to,
 * nudging one edge by a step, whether a draft window can be saved, and whether
 * an edit moves the clip's footage so the clip must be cut again.
 */
import { DEFAULT_TOLERANCE, vectorCase, type VectorFile } from "./vector";

import { clipWindowChanged } from "@/features/tagging/edit/recut";
import {
  effectiveEnd,
  isValidWindow,
  nudgeEdge,
  TRIM_STEP_S,
  type TrimWindow,
  type WindowEdge,
} from "@/features/tagging/edit/trim";

const GAME_LENGTH_S = 4800;

/** A goal captured at 1000 s with its default window made explicit. */
const EXPLICIT: TrimWindow = { type: "goal", startS: 990, endS: 1005 };
/** The same tag while it still uses its type's default follow-through. */
const DEFAULT_END: TrimWindow = { type: "goal", startS: 990, endS: null };

function endCase(name: string, window: TrimWindow) {
  return vectorCase(name, "effectiveEnd", { window }, (i) =>
    effectiveEnd(i.window),
  );
}

function nudgeCase(
  name: string,
  window: TrimWindow,
  edge: WindowEdge,
  deltaS: number,
  maxS: number = GAME_LENGTH_S,
) {
  return vectorCase(name, "nudgeEdge", { window, edge, deltaS, maxS }, (i) =>
    nudgeEdge(i.window, i.edge, i.deltaS, i.maxS),
  );
}

function validCase(name: string, window: TrimWindow) {
  return vectorCase(name, "isValidWindow", { window }, (i) =>
    isValidWindow(i.window),
  );
}

function recutCase(name: string, before: TrimWindow, after: TrimWindow) {
  return vectorCase(name, "clipWindowChanged", { before, after }, (i) =>
    clipWindowChanged(i.before, i.after),
  );
}

export function buildTagEdit(): VectorFile {
  return {
    contract: "tag-edit",
    description:
      "effectiveEnd is the end a draft window is cut to: its explicit end, else " +
      "its type's default postS after the start (tag-types.json), else the cut " +
      "plan's fallbackClipWindowS for an unknown type. nudgeEdge moves one edge " +
      "by deltaS, clamped to [0, maxS]; nudging a default end starts from its " +
      "effective end and makes it explicit, and the other edge never moves, so " +
      "the result may be empty or inverted. isValidWindow is whether a draft can " +
      "be saved: its effective end lies after its start. clipWindowChanged is " +
      "whether an edit moves the footage a cut clip holds: a moved start or end " +
      "always does, a type change only while the end is the type's default.",
    reference: [
      "src/features/tagging/edit/trim.ts",
      "src/features/tagging/edit/recut.ts",
    ],
    tolerance: DEFAULT_TOLERANCE,
    constants: { trimStepS: TRIM_STEP_S },
    cases: [
      endCase("an explicit end", EXPLICIT),
      endCase("a goal's default end", DEFAULT_END),
      endCase("a short corner's default end", {
        type: "corner_short",
        startS: 992,
        endS: null,
      }),
      endCase("an unknown type falls back", {
        type: "retired_type",
        startS: 990,
        endS: null,
      }),

      nudgeCase("the start one step earlier", EXPLICIT, "start", -TRIM_STEP_S),
      nudgeCase("the start one step later", EXPLICIT, "start", TRIM_STEP_S),
      nudgeCase("the end one step later", EXPLICIT, "end", TRIM_STEP_S),
      nudgeCase(
        "a default end becomes explicit",
        DEFAULT_END,
        "end",
        -TRIM_STEP_S,
      ),
      nudgeCase(
        "the start keeps a default end",
        DEFAULT_END,
        "start",
        TRIM_STEP_S,
      ),
      nudgeCase(
        "the start stops at the game start",
        { type: "goal", startS: 0.4, endS: 5 },
        "start",
        -TRIM_STEP_S,
      ),
      nudgeCase(
        "the end stops at the game end",
        { type: "goal", startS: 4790, endS: 4799.5 },
        "end",
        TRIM_STEP_S,
      ),
      nudgeCase(
        "the start may pass the end",
        { type: "goal", startS: 1004.5, endS: 1005 },
        "start",
        TRIM_STEP_S,
      ),
      nudgeCase(
        "a fractional start keeps its fraction",
        { type: "action_good", startS: 1226.56, endS: 1238.56 },
        "start",
        -TRIM_STEP_S,
      ),

      validCase("an explicit window", EXPLICIT),
      validCase("a default window", DEFAULT_END),
      validCase("an empty window", { type: "goal", startS: 1005, endS: 1005 }),
      validCase("an inverted window", {
        type: "goal",
        startS: 1006,
        endS: 1005,
      }),

      recutCase("nothing changed", EXPLICIT, EXPLICIT),
      recutCase("a moved start", EXPLICIT, { ...EXPLICIT, startS: 989 }),
      recutCase("a moved end", EXPLICIT, { ...EXPLICIT, endS: 1006 }),
      recutCase("an end set on a default window", DEFAULT_END, EXPLICIT),
      recutCase("an end cleared back to the default", EXPLICIT, DEFAULT_END),
      recutCase("a new type with an explicit end", EXPLICIT, {
        ...EXPLICIT,
        type: "corner_short",
      }),
      recutCase("a new type with a default end", DEFAULT_END, {
        ...DEFAULT_END,
        type: "corner_short",
      }),
    ],
  };
}
