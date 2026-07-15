"use client";

/**
 * Quarter bands drawn across the player's timeline track (P1-4). This fills the
 * player's `timelineOverlay` slot; it is purely visual and never intercepts
 * pointer events, so the scrubber laid over the same track keeps working. Band
 * geometry comes from the pure {@link quarterBands} helper.
 */
import { quartersContent } from "./content";
import { quarterBands, type Quarter } from "./navigation";

export interface QuarterMarkersProps {
  readonly quarters: readonly Quarter[];
  /** Total game length in seconds, used to place the bands. */
  readonly durationS: number;
}

export function QuarterMarkers({ quarters, durationS }: QuarterMarkersProps) {
  const bands = quarterBands(quarters, durationS);
  if (bands.length === 0) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {bands.map((band) => (
        <span
          key={band.index}
          title={quartersContent.quarterLabel(band.index)}
          className="absolute inset-y-0 border-l border-[color:var(--border-strong)]"
          style={{ left: `${band.startFraction * 100}%` }}
        />
      ))}
    </div>
  );
}
