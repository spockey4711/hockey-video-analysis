import type { HTMLAttributes } from "react";

import { cn } from "../core/cn";

import { formatGameTime } from "./format-timecode";

export type TimecodeSize = "sm" | "md" | "lg";

export interface TimecodeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Global game-time offset in seconds (P0-4 contract, see format-timecode). */
  seconds: number;
  /** Also render the hundredths, accent-tinted, for frame-accurate marks. */
  frac?: boolean;
  size?: TimecodeSize;
  /** Dim the readout for secondary/inactive timecodes. */
  muted?: boolean;
}

const SIZES: Record<TimecodeSize, string> = {
  sm: "text-[length:var(--fs-body-sm)]",
  md: "text-[length:var(--fs-body)]",
  lg: "text-[length:var(--fs-title)]",
};

/**
 * Mono, tabular game-time readout. Formats via the P0-4 time-mapping contract
 * (`seconds` is a single global offset since game start) and auto-selects
 * `H:MM:SS` once past an hour, otherwise `M:SS`. With `frac`, the hundredths are
 * appended in the accent tint.
 */
export function Timecode({
  seconds,
  frac = false,
  size = "md",
  muted = false,
  className,
  ...rest
}: TimecodeProps) {
  const { main, hundredths } = formatGameTime(seconds);
  return (
    <span
      className={cn(
        "[font-family:var(--font-mono)] tabular-nums",
        muted
          ? "text-[color:var(--text-muted)]"
          : "text-[color:var(--text-primary)]",
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {main}
      {frac && (
        <span className="text-[color:var(--accent)]">.{hundredths}</span>
      )}
    </span>
  );
}
