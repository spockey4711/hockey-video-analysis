/**
 * Pure math for trimming a tag's clip window in the edit panel: nudging one edge
 * by a fixed step. No DOM or DB dependency, so it is unit-tested directly; the
 * panel only wires it to buttons and the player.
 */
import { resolveClipEnd } from "@/features/clips/cut/window";
import type { TagWindows } from "@/lib/tag-types";

/** How far one nudge moves a window edge, in seconds. */
export const TRIM_STEP_S = 1;

/** A draft clip window as the edit panel holds it (global game-time seconds). */
export interface TrimWindow {
  readonly type: string;
  readonly startS: number;
  /** Null while the tag uses its type's default window. */
  readonly endS: number | null;
}

export type WindowEdge = "start" | "end";

/**
 * The end the clip will actually be cut to: the explicit end, or the type's
 * follow-through in `windows` after the start (the worker's `resolveClipEnd`).
 */
export function effectiveEnd(window: TrimWindow, windows: TagWindows): number {
  return (
    window.endS ?? resolveClipEnd(window.startS, null, window.type, windows)
  );
}

/**
 * Move one edge of `window` by `deltaS`, clamped to `[0, maxS]`. Nudging the
 * end of a default window starts from its effective end and makes it explicit.
 * The result may be empty or inverted (start at or past the end); the panel
 * blocks saving such a window rather than silently pushing the other edge.
 */
export function nudgeEdge(
  window: TrimWindow,
  edge: WindowEdge,
  deltaS: number,
  maxS: number,
  windows: TagWindows,
): TrimWindow {
  const clamp = (s: number) => Math.min(Math.max(s, 0), maxS);
  if (edge === "start") {
    return { ...window, startS: clamp(window.startS + deltaS) };
  }
  return { ...window, endS: clamp(effectiveEnd(window, windows) + deltaS) };
}

/** Whether a draft window can be saved: its end lies after its start. */
export function isValidWindow(
  window: TrimWindow,
  windows: TagWindows,
): boolean {
  return effectiveEnd(window, windows) > window.startS;
}
