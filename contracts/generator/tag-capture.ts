/**
 * Golden vectors for capturing a tag: a hotkey picks the type, and the type's
 * window from `tag-types.json` turns the capture point into the clip window,
 * clamped to the game.
 */
import { DEFAULT_TOLERANCE, vectorCase, type VectorFile } from "./vector";

import { captureTag } from "@/features/tagging/capture";
import { getTagType, tagTypeForHotkey } from "@/lib/tag-types";

/** A game of four 15-minute quarters with breaks, in seconds. */
const GAME_LENGTH_S = 4800;

function captureCase(name: string, type: string, atS: number, maxS?: number) {
  const input = maxS === undefined ? { type, atS } : { type, atS, maxS };
  return vectorCase(name, "captureTag", input, (i) => {
    const def = getTagType(i.type);
    if (!def) throw new Error(`unknown tag type ${i.type} in a vector case`);
    return captureTag(def, i.atS, "maxS" in i ? { maxS: i.maxS } : undefined);
  });
}

function hotkeyCase(name: string, key: string) {
  return vectorCase(
    name,
    "tagTypeForHotkey",
    { key },
    (i) => tagTypeForHotkey(i.key)?.key ?? null,
  );
}

export function buildTagCapture(): VectorFile {
  return {
    contract: "tag-capture",
    description:
      "A capture at game time atS becomes the window [atS - preS, atS + postS] " +
      "of its type (tag-types.json). The start never drops below 0; with the game " +
      "length maxS, the capture point and the end never pass it. tagTypeForHotkey " +
      "returns the type key a key press captures, case-insensitively, or null.",
    reference: [
      "src/features/tagging/capture.ts",
      "src/lib/tag-types/index.ts",
    ],
    tolerance: DEFAULT_TOLERANCE,
    cases: [
      captureCase("a goal", "goal", 1000, GAME_LENGTH_S),
      captureCase("a short corner", "corner_short", 1000, GAME_LENGTH_S),
      captureCase("a good action", "action_good", 1000, GAME_LENGTH_S),
      captureCase("a bad action", "action_bad", 1000, GAME_LENGTH_S),
      captureCase(
        "a fractional capture time",
        "action_good",
        1234.56,
        GAME_LENGTH_S,
      ),
      captureCase("the start is clamped to 0", "goal", 4, GAME_LENGTH_S),
      captureCase("a capture at the game start", "goal", 0, GAME_LENGTH_S),
      captureCase(
        "the end is clamped to the game",
        "goal",
        4798,
        GAME_LENGTH_S,
      ),
      captureCase(
        "a capture past the game is moved to its end",
        "goal",
        4900,
        GAME_LENGTH_S,
      ),
      captureCase("without a game length the end is open", "goal", 5000),
      captureCase("rejects a negative capture time", "goal", -1, GAME_LENGTH_S),
      captureCase("rejects a zero game length", "goal", 10, 0),
      captureCase("rejects a negative game length", "goal", 10, -5),

      hotkeyCase("t captures a goal", "t"),
      hotkeyCase("e captures a short corner", "e"),
      hotkeyCase("g captures a good action", "g"),
      hotkeyCase("s captures a bad action", "s"),
      hotkeyCase("an upper-case key matches too", "T"),
      hotkeyCase("the frame-step key captures nothing", "b"),
      hotkeyCase("an unbound key captures nothing", "x"),
    ],
  };
}
