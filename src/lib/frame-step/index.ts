/**
 * How long one frame of a chapter lasts, for the single-frame step (B / N and
 * the frame buttons) in the watch player, the clip editor and the edited-clip
 * stage.
 *
 * Each chapter records the frame rate ffprobe read when it was imported
 * (`game_sources.frame_rate`); a step moves exactly one frame of the chapter
 * under the playhead, so 50 fps GoPro footage steps 1/50 s and 25 fps footage
 * 1/25 s. A chapter imported before the rate was recorded has none, and steps
 * by {@link DEFAULT_FRAME_RATE}.
 *
 * Units: seconds and frames per second. Pure, shared by server and client.
 */
import { toSourcePoint, totalDurationS } from "@/lib/time-mapping";

/**
 * The rate assumed when a chapter's is unknown: the slowest a recording
 * plausibly has. On faster footage a press then advances more than one frame,
 * which still reads as a step; a smaller value would land twice inside the
 * same frame on 25 fps material and look like a dead key.
 */
export const DEFAULT_FRAME_RATE = 25;

/** The fastest rate a camera records (GoPro high-frame-rate modes reach 240). */
export const MAX_FRAME_RATE = 240;

/**
 * `value` as a frame rate, or null when it is not one a recording can have:
 * not a finite number, zero or less, or above {@link MAX_FRAME_RATE}.
 */
export function usableFrameRate(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value > 0 && value <= MAX_FRAME_RATE ? value : null;
}

/** Seconds one frame lasts at `frameRate`, falling back to the default rate. */
export function frameDurationS(frameRate: number | null | undefined): number {
  return 1 / (usableFrameRate(frameRate) ?? DEFAULT_FRAME_RATE);
}

/** One chapter of a game, as far as its frame rate is concerned. */
export interface ChapterFrameRate {
  readonly durationS: number;
  /** Frames per second, or null when the chapter was imported without one. */
  readonly frameRate: number | null;
}

/**
 * The frame rate of the chapter playing at `gameTimeS` (ADR 0002's mapping,
 * `gameTimeS` clamped to the game), or null when the game has no chapters or
 * that chapter's rate is unknown.
 */
export function frameRateAt(
  chapters: readonly ChapterFrameRate[],
  gameTimeS: number,
): number | null {
  if (chapters.length === 0) return null;
  const durationsS = chapters.map((chapter) => chapter.durationS);
  const clampedS = Math.min(Math.max(gameTimeS, 0), totalDurationS(durationsS));
  const { sourceIndex } = toSourcePoint(durationsS, clampedS);
  return usableFrameRate(chapters[sourceIndex].frameRate);
}
