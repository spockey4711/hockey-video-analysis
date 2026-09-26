/**
 * Golden vectors for the clip cut contract (ADR 0004, 0007): where a tag's clip
 * ends when it has no stored end, and the per-chapter pieces a clip is cut and
 * joined from. Every cutter - the VPS worker and the Mac - follows this plan.
 */
import { DEFAULT_TOLERANCE, vectorCase, type VectorFile } from "./vector";

import {
  planClipCut,
  type ClipSource,
} from "@/features/clips/boundary/cut-plan";
import {
  FALLBACK_CLIP_WINDOW_S,
  resolveClipEnd,
} from "@/features/clips/cut/window";

/** A game folder of one recording in three chapters. */
const SOURCES: ClipSource[] = [
  { orderIndex: 0, filePath: "Game A/GX010042.MP4", durationS: 531.531 },
  { orderIndex: 1, filePath: "Game A/GX020042.MP4", durationS: 531.531 },
  { orderIndex: 2, filePath: "Game A/GX030042.MP4", durationS: 212.345 },
];
const GAME_END =
  SOURCES[0].durationS + SOURCES[1].durationS + SOURCES[2].durationS;

function planCase(
  name: string,
  sources: ClipSource[],
  startS: number,
  endS: number,
) {
  return vectorCase(name, "planClipCut", { sources, startS, endS }, (i) =>
    planClipCut(i.sources, i.startS, i.endS),
  );
}

function endCase(
  name: string,
  startS: number,
  endS: number | null,
  tagType: string,
) {
  return vectorCase(name, "resolveClipEnd", { startS, endS, tagType }, (i) =>
    resolveClipEnd(i.startS, i.endS, i.tagType),
  );
}

export function buildCutPlan(): VectorFile {
  return {
    contract: "cut-plan",
    description:
      "resolveClipEnd is the game time a tag's clip ends at: its stored end, " +
      "else its type's postS after the start (tag-types.json), else " +
      "fallbackClipWindowS for an unknown type. planClipCut orders the chapters " +
      "by orderIndex (they must be exactly 0..N-1) and splits the window into the " +
      "per-file pieces [localStartS, localEndS) a cutter copies and joins in order.",
    reference: [
      "src/features/clips/cut/window.ts",
      "src/features/clips/boundary/cut-plan.ts",
    ],
    tolerance: DEFAULT_TOLERANCE,
    constants: { fallbackClipWindowS: FALLBACK_CLIP_WINDOW_S },
    cases: [
      endCase("a stored end wins", 515, 530, "goal"),
      endCase("a goal without an end", 515, null, "goal"),
      endCase("a short corner without an end", 515, null, "corner_short"),
      endCase("an unknown type without an end", 515, null, "retired_type"),
      endCase("rejects a negative start", -1, null, "goal"),
      endCase("rejects an end at the start", 515, 515, "goal"),
      endCase("rejects an end before the start", 515, 510, "goal"),

      planCase("a clip inside one chapter", SOURCES, 515, 530),
      planCase("a clip across a seam", SOURCES, 518, 533),
      planCase("a clip over a whole middle chapter", SOURCES, 530, 1070),
      planCase("a clip ending at the game end", SOURCES, 1270, GAME_END),
      planCase(
        "chapters in any order are sorted",
        [SOURCES[2], SOURCES[0], SOURCES[1]],
        518,
        533,
      ),
      planCase(
        "rejects a gap in the chapter order",
        [SOURCES[0], SOURCES[2]],
        10,
        20,
      ),
      planCase("rejects a repeated chapter", [SOURCES[0], SOURCES[0]], 10, 20),
      planCase("rejects a game without chapters", [], 10, 20),
      planCase("rejects an empty window", SOURCES, 20, 20),
      planCase("rejects a window past the game", SOURCES, 1270, 1280),
    ],
  };
}
