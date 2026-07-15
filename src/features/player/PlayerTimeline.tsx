"use client";

import type { ReactNode } from "react";

import { PlayerScrubBar } from "./PlayerScrubBar";
import type { ChapterLane } from "./chapters";

export interface PlayerTimelineProps {
  readonly gameTimeS: number;
  readonly durationS: number;
  readonly onSeek: (gameTimeS: number) => void;
  /** Chapter lanes (V1..Vn) placed across the whole game timeline. */
  readonly lanes: readonly ChapterLane[];
  /** Bands and ticks drawn behind the scrubber handle (quarters, tag markers). */
  readonly timelineOverlay?: ReactNode;
  /** Controls rendered above the track (jump-to-tag nav, quarter editor). */
  readonly controls?: ReactNode;
}

/**
 * The full-width chapter timeline along the bottom of the workspace. One lane per
 * chapter (V1..Vn from {@link chapterLanes}) sits behind a continuous game-time
 * scrubber, with quarter bands and tag ticks layered in via the overlay slot and
 * navigation controls above. The scrubber spans the whole game, not the active
 * chapter, so a coach scrubs the match as one timeline (ADR 0002).
 */
export function PlayerTimeline({
  gameTimeS,
  durationS,
  onSeek,
  lanes,
  timelineOverlay,
  controls,
}: PlayerTimelineProps) {
  return (
    <div className="flex h-full flex-col justify-center gap-[var(--space-3)] px-[var(--space-6)] py-[var(--space-3)]">
      {controls ? (
        <div className="flex items-center gap-[var(--space-2)]">{controls}</div>
      ) : null}

      <div className="relative">
        {/* Chapter labels along the top of the track. */}
        {lanes.length > 1 ? (
          <div
            aria-hidden
            className="relative mb-[var(--space-2)] h-[var(--space-4)]"
          >
            {lanes.map((lane) => (
              <span
                key={lane.label}
                style={{ left: `${lane.startFraction * 100}%` }}
                className="absolute top-0 ps-[var(--space-1)] font-[family-name:var(--font-mono)] text-[length:var(--fs-micro)] tracking-[var(--ls-wide)] text-[color:var(--text-muted)] uppercase"
              >
                {lane.label}
              </span>
            ))}
          </div>
        ) : null}

        {/* Lane separators aligned to the scrubber track. */}
        <div className="relative">
          {lanes.length > 1
            ? lanes
                .slice(1)
                .map((lane) => (
                  <span
                    key={lane.label}
                    aria-hidden
                    style={{ left: `${lane.startFraction * 100}%` }}
                    className="pointer-events-none absolute inset-y-0 z-10 w-px bg-[var(--border-strong)]"
                  />
                ))
            : null}
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
