"use client";

import type { ReactNode } from "react";

import { playerContent } from "./content";

import { cn } from "@/components/core/cn";

export interface PlayerScrubBarProps {
  /** Current position on the game timeline, in seconds. */
  readonly gameTimeS: number;
  /** Total game length, in seconds. */
  readonly durationS: number;
  readonly onSeek: (gameTimeS: number) => void;
  /**
   * Rendered across the full width of the timeline track, behind the handle
   * (e.g. quarter bands from P1-4, tag ticks from P0-6). The slot child owns its
   * own absolute positioning within the track's coordinate space.
   */
  readonly timelineOverlay?: ReactNode;
}

/** Fraction of the game elapsed, clamped to `[0, 1]` and safe when duration is 0. */
function progressFraction(gameTimeS: number, durationS: number): number {
  if (durationS <= 0) return 0;
  return Math.min(Math.max(gameTimeS / durationS, 0), 1);
}

/**
 * The game-time scrubber: one continuous track spanning the whole game, not the
 * active chapter. A visible filled track shows progress while a transparent
 * range input laid over it provides pointer and keyboard seeking with native
 * accessibility. Overlay children (quarter bands, tag ticks) render behind the
 * handle via the {@link PlayerScrubBarProps.timelineOverlay} slot.
 */
export function PlayerScrubBar({
  gameTimeS,
  durationS,
  onSeek,
  timelineOverlay,
}: PlayerScrubBarProps) {
  const fraction = progressFraction(gameTimeS, durationS);

  return (
    <div className="relative flex h-[var(--space-5)] w-full items-center">
      <div className="absolute inset-x-0 h-[var(--space-2)] overflow-hidden rounded-[var(--radius-pill)] bg-[var(--surface-inset)]">
        {timelineOverlay}
        <div
          className="absolute inset-y-0 left-0 rounded-[var(--radius-pill)] bg-[var(--accent)]"
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={durationS}
        step={0.1}
        value={Math.min(gameTimeS, durationS)}
        aria-label={playerContent.scrub.label}
        onChange={(event) => onSeek(Number(event.target.value))}
        className={cn(
          "absolute inset-x-0 h-full w-full cursor-pointer appearance-none bg-transparent",
          "focus-visible:outline-none",
        )}
      />
    </div>
  );
}
