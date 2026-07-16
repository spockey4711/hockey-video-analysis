"use client";

import type { ReactNode } from "react";

import { PlayerScrubBar } from "./PlayerScrubBar";
import type { SourceBreak } from "./source-breaks";

export interface PlayerTimelineProps {
  readonly gameTimeS: number;
  readonly durationS: number;
  readonly onSeek: (gameTimeS: number) => void;
  /**
   * Discontinuities where a genuinely new recording starts (not the seamless
   * GoPro chapter splits). Drawn as ticks across the track; see
   * {@link sourceBreaks}.
   */
  readonly breaks: readonly SourceBreak[];
  /** Labels above the track (quarter V1..V4 markers). */
  readonly timelineLabels?: ReactNode;
  /** Bands and ticks drawn behind the scrubber handle (quarters, tag markers). */
  readonly timelineOverlay?: ReactNode;
  /** Controls rendered above the track (jump-to-tag nav, quarter editor). */
  readonly controls?: ReactNode;
}

/**
 * The full-width game timeline along the bottom of the workspace. A continuous
 * game-time scrubber spans the whole match (not the active chapter, so a coach
 * scrubs it as one timeline; ADR 0002). The imported chapter files are invisible;
 * only real recording cuts show as break ticks ({@link sourceBreaks}). Quarter
 * V-labels sit above the track and quarter bands / tag ticks layer in via the
 * overlay slot, with navigation controls above.
 */
export function PlayerTimeline({
  gameTimeS,
  durationS,
  onSeek,
  breaks,
  timelineLabels,
  timelineOverlay,
  controls,
}: PlayerTimelineProps) {
  return (
    <div className="flex h-full flex-col justify-center gap-[var(--space-3)] px-[var(--space-6)] py-[var(--space-3)]">
      {controls ? (
        <div className="flex items-center gap-[var(--space-2)]">{controls}</div>
      ) : null}

      <div className="relative">
        {/* Quarter labels (V1..V4) along the top of the track. */}
        {timelineLabels ? (
          <div className="relative mb-[var(--space-2)] h-[var(--space-4)]">
            {timelineLabels}
          </div>
        ) : null}

        {/* Recording-cut ticks aligned to the scrubber track. */}
        <div className="relative">
          {breaks.map((brk) => (
            <span
              key={brk.startFraction}
              aria-hidden
              style={{ left: `${brk.startFraction * 100}%` }}
              className="pointer-events-none absolute inset-y-0 z-10 w-px bg-[var(--border-strong)]"
            />
          ))}
          <PlayerScrubBar
            gameTimeS={gameTimeS}
            durationS={durationS}
            onSeek={onSeek}
            timelineOverlay={timelineOverlay}
          />
        </div>
      </div>
    </div>
  );
}
