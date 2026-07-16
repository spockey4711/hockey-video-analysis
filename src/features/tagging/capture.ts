/**
 * Pure tag-capture math (P0-6). Turns a capture point on the global game
 * timeline (P0-4 coordinate, seconds) plus a tag type into the concrete clip
 * window that gets persisted, applying the type's default lead-in/follow-through
 * (PRD 5.2). No DB or DOM dependency, so it is unit-tested directly.
 */
import type { TagTypeDef } from "@/lib/tag-types";

/** The start/end window a capture resolves to, in global game-time seconds. */
export interface CapturedTag {
  /** The captured tag-type key (`TagTypeDef.key`). */
  readonly type: string;
  readonly startS: number;
  readonly endS: number;
}

/**
 * Resolve the default clip window for capturing `type` at global time `atS`.
 *
 * The window is `[atS - preS, atS + postS]`, clamped to the game bounds: the
 * start never goes below 0, and when `maxS` (the total game duration) is given
 * the capture point and end never exceed it. Clamping `atS` first keeps the
 * window well-ordered even if the caller reports a time past the final frame.
 *
 * @throws RangeError if `atS` is not a finite, non-negative number.
 */
export function captureTag(
  type: TagTypeDef,
  atS: number,
  opts?: { readonly maxS?: number },
): CapturedTag {
  if (!Number.isFinite(atS) || atS < 0) {
    throw new RangeError(`capture time ${atS}s is out of range`);
  }
  const maxS = opts?.maxS;
  if (maxS !== undefined && (!Number.isFinite(maxS) || maxS <= 0)) {
    throw new RangeError(`game duration ${maxS}s is out of range`);
  }

  const at = maxS !== undefined ? Math.min(atS, maxS) : atS;
  const startS = Math.max(0, at - type.window.preS);
  const endS =
    maxS !== undefined
      ? Math.min(at + type.window.postS, maxS)
      : at + type.window.postS;
  return { type: type.key, startS, endS };
}

/**
 * Format a game-time offset in seconds as a `m:ss` (or `h:mm:ss`) clock, for
 * capture confirmations. Negative or non-finite input formats as `0:00`.
 */
export function formatClock(totalS: number): string {
  const safe = Number.isFinite(totalS) && totalS > 0 ? Math.floor(totalS) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
