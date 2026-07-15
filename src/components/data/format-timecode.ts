/**
 * Format a global game-time offset into a HUD timecode readout.
 *
 * The input is a single non-negative offset in seconds since the start of the
 * game - the coordinate defined by the P0-4 time-mapping contract
 * (`src/lib/time-mapping`, ADR 0002), where fractional seconds are allowed and
 * valid offsets live in `[0, totalDurationS]`. This is the pure display half of
 * that contract; `Timecode` renders what this returns.
 */

export interface FormattedTimecode {
  /** Whole-time portion: `H:MM:SS` from an hour up, otherwise `M:SS`. */
  readonly main: string;
  /** Two-digit hundredths of a second (`"00".."99"`), never dot-prefixed. */
  readonly hundredths: string;
}

/**
 * Split a game-time offset into its display parts. Non-finite or negative inputs
 * clamp to zero (the contract's lower bound), so the readout never shows `NaN` or
 * a stray minus. Seconds are rounded to the nearest hundredth first to keep float
 * error out of the boundary (e.g. `0.29 -> .29`, not `.28`).
 */
export function formatGameTime(seconds: number): FormattedTimecode {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const centi = Math.round(safe * 100);
  const whole = Math.floor(centi / 100);
  const hundredths = centi % 100;

  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  const ss = String(secs).padStart(2, "0");

  const main =
    hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${ss}`
      : `${minutes}:${ss}`;

  return { main, hundredths: String(hundredths).padStart(2, "0") };
}
