"use client";

import type { ReactNode } from "react";

import { PlaybackRateControl } from "./PlaybackRateControl";
import type { PlayerController } from "./PlayerContext";
import { playerContent } from "./content";
import { formatGameClock } from "./format-timecode";
import { SKIP_S, STEP_S } from "./useTransportHotkeys";

import { IconButton } from "@/components/forms/IconButton";

export interface PlayerTransportProps {
  readonly controller: PlayerController;
  /** Tag-capture buttons rendered on the right of the bar (from the tagging lane). */
  readonly tagControls?: ReactNode;
}

/**
 * The transport bar directly under the video: seek/step/play controls and the
 * scan-speed toggle on the left, the mono game clock in the middle, and the
 * tag-capture buttons on the right. The clock reads `M:SS / total`; tagging is
 * injected as a slot so the player stays decoupled from the tagging lane.
 */
export function PlayerTransport({
  controller,
  tagControls,
}: PlayerTransportProps) {
  const { gameTimeS, durationS, isPlaying } = controller;
  const { transport } = playerContent;

  return (
    <div className="flex items-center gap-[var(--space-4)] border-t border-[color:var(--border)] px-[var(--space-4)] py-[var(--space-2)]">
      <div className="flex items-center gap-[var(--space-1)]">
        <IconButton
          name="rewind"
          label={transport.rewind}
          onClick={() => controller.seekBy(-SKIP_S)}
        />
        <IconButton
          name="step-back"
          label={transport.stepBack}
          onClick={() => controller.stepBy(-STEP_S)}
        />
        <IconButton
          name={isPlaying ? "pause" : "play"}
          label={isPlaying ? transport.pause : transport.play}
          variant="solid"
          onClick={controller.togglePlay}
        />
        <IconButton
          name="step-forward"
          label={transport.stepForward}
          onClick={() => controller.stepBy(STEP_S)}
        />
        <IconButton
          name="fast-forward"
          label={transport.forward}
          onClick={() => controller.seekBy(SKIP_S)}
        />
        <PlaybackRateControl />
      </div>

      <span className="font-[family-name:var(--font-mono)] text-[length:var(--fs-body)] text-[color:var(--text-primary)] tabular-nums">
        {formatGameClock(gameTimeS)} / {formatGameClock(durationS)}
      </span>

      {tagControls ? (
        <div className="ms-auto flex items-center gap-[var(--space-2)]">
          {tagControls}
        </div>
      ) : null}
    </div>
  );
}
