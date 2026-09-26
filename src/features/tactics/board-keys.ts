/**
 * The board's keyboard shortcuts as a pure mapping from a key press to a
 * board action, shared by the scene editor and the board in presentation
 * mode so both answer the same keys: `Ctrl`/`Cmd`+`Z` undoes, `o` toggles the
 * dotted line, `w` cycles the width, the space bar plays or pauses, and `b`
 * and `n` step back and forward. Arrow keys, `Entf` and `Escape` belong to
 * the focused token or line (see `BoardCanvas`).
 */
import type { BoardAction, BoardState } from "./board-state";

import { nextStrokeWidth } from "@/features/player/telestration/state";

/** The parts of a key press the mapping reads. */
export interface BoardKeyEvent {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly target: EventTarget | null;
}

/** Whether a key press belongs to a text field rather than the board. */
export function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName))
  );
}

/** Whether the space bar already presses the focused control. */
function isPressable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.tagName === "BUTTON";
}

/**
 * The board action a key press stands for, or `null` when the board leaves
 * the key alone (typing in a field, a modifier combination the board does
 * not use, or a key it has no shortcut for).
 */
export function boardKeyAction(
  event: BoardKeyEvent,
  state: Pick<BoardState, "playback" | "width">,
): BoardAction | null {
  if (isTyping(event.target)) return null;
  const key = event.key.toLowerCase();
  if (event.ctrlKey || event.metaKey) {
    return key === "z" ? { type: "undo" } : null;
  }
  if (event.altKey) return null;
  switch (key) {
    case "o":
      return { type: "toggleLineStyle" };
    case "w":
      return { type: "setWidth", width: nextStrokeWidth(state.width) };
    case " ":
      if (isPressable(event.target)) return null;
      return { type: state.playback?.playing ? "pause" : "play" };
    case "b":
      return { type: "stepBack" };
    case "n":
      return { type: "stepForward" };
    default:
      return null;
  }
}
