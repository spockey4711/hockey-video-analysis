/**
 * Where the game timeline crosses from one recording into a genuinely new one.
 *
 * The imported chapter files are invisible on the timeline: a GoPro splits one
 * continuous recording into ~4 GB chapters that play back seamlessly, so those
 * splits must not clutter the scrubber. Only a real cut - a new recording that
 * does not continue the previous file - is marked, so a coach sees where the
 * footage actually jumps.
 *
 * Continuity is read from the GoPro chaptering convention: the chapters of one
 * recording share the same trailing file number (`GX01`**`0042`**, `GX02`**`0042`**,
 * ...), while a new recording bumps that number (`GX01`**`0043`**). Consecutive
 * sources with a different recording id are a break. A name that does not match
 * the convention yields no id, and an unknown boundary is treated as continuous -
 * the timeline stays clean unless we can positively identify a new recording.
 *
 * Pure and duration-only, so it is trivially testable and shared by the timeline
 * and its test.
 */

/** A discontinuity between two chapters, placed on the game timeline. */
export interface SourceBreak {
  /** Left edge as a fraction of the total game length, in `[0, 1]`. */
  readonly startFraction: number;
}

/** One chapter as this helper needs it: its file name and duration. */
export interface SourceBreakInput {
  /** Chapter file basename, e.g. `GX010042.MP4`. */
  readonly label: string;
  readonly durationS: number;
}

// New-style GoPro chapter file: two prefix letters, a 2-digit chapter number,
// then the 4-digit recording id, e.g. `GX010042`. The recording id is captured.
const GOPRO_CHAPTER = /^(?:GX|GH|GP)\d{2}(\d{4})$/i;
// First chapter of an older GoPro recording, e.g. `GOPR0042`; later chapters use
// the `GP01xxxx` form above, sharing the same recording id.
const GOPRO_FIRST = /^GOPR(\d{4})$/i;

/**
 * The GoPro recording id of a chapter file - the trailing 4-digit file number
 * shared by every chapter of one recording - or `null` when the name does not
 * match the GoPro convention (so continuity cannot be inferred from it).
 */
export function recordingId(label: string): string | null {
  const name = label.split(/[\\/]/).pop() ?? label;
  const stem = name.replace(/\.[^.]*$/, "");
  const chapter = stem.match(GOPRO_CHAPTER);
  if (chapter) return chapter[1];
  const first = stem.match(GOPRO_FIRST);
  if (first) return first[1];
  return null;
}

/** Whether `next` starts a new recording that does not continue `prev`. */
function isBreak(prev: string, next: string): boolean {
  const a = recordingId(prev);
  const b = recordingId(next);
  // An unrecognized name on either side cannot confirm a new clip - keep quiet.
  if (a === null || b === null) return false;
  return a !== b;
}

/** Usable width of a chapter for timeline layout (zero for bad durations). */
function laneWidth(durationS: number): number {
  return Number.isFinite(durationS) && durationS > 0 ? durationS : 0;
}

/**
 * The discontinuities in an ordered chapter list, each placed as a fraction of
 * the total game length. Returns an empty list when the total length is not
 * positive (nothing to place yet) or when every chapter continues the last.
 */
export function sourceBreaks(
  sources: readonly SourceBreakInput[],
): SourceBreak[] {
  const total = sources.reduce((sum, s) => sum + laneWidth(s.durationS), 0);
  if (!(total > 0)) return [];

  const breaks: SourceBreak[] = [];
  let elapsed = 0;
  for (let i = 0; i < sources.length; i += 1) {
    if (i > 0 && isBreak(sources[i - 1].label, sources[i].label)) {
      breaks.push({ startFraction: elapsed / total });
    }
    elapsed += laneWidth(sources[i].durationS);
  }
  return breaks;
}
