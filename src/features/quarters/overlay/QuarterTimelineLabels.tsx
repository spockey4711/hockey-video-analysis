"use client";

/**
 * The quarter markers (V1..V4) drawn above the player's timeline track (P1-4).
 * These label the manually marked quarters - the imported video files no longer
 * get their own labels - so a coach reads the timeline in match quarters, not by
 * recording. This fills the player's `timelineLabels` slot.
 *
 * Band geometry comes from the pure {@link quarterBands} helper and needs the
 * game's total length, which is only known live from the video metadata; this
 * connector reads it from the player controller, so the page never guesses a
 * duration. No quarter logic lives here.
 */
import { quartersContent } from "../content";
import { quarterBands, type Quarter } from "../navigation";

import { usePlayerController } from "@/features/player";

export interface QuarterTimelineLabelsProps {
  /** Quarters already persisted for the game (empty when none set yet). */
  readonly quarters: readonly Quarter[];
}

export function QuarterTimelineLabels({
  quarters,
}: QuarterTimelineLabelsProps) {
  const { durationS } = usePlayerController();
  const bands = quarterBands(quarters, durationS);
  if (bands.length === 0) return null;

  return (
    <div aria-hidden className="absolute inset-0">
      {bands.map((band) => (
        <span
          key={band.index}
          style={{ left: `${band.startFraction * 100}%` }}
          className="absolute top-0 ps-[var(--space-1)] font-[family-name:var(--font-mono)] text-[length:var(--fs-micro)] tracking-[var(--ls-wide)] text-[color:var(--text-muted)] uppercase"
        >
          {quartersContent.bandLabel(band.index)}
        </span>
      ))}
    </div>
  );
}
