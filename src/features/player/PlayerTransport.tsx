"use client";

import type { ReactNode } from "react";

import { useClockFormat } from "./ClockFormatContext";
import { useFullscreenState } from "./FullscreenContext";
import { PlaybackRateControl } from "./PlaybackRateControl";
import type { PlayerController } from "./PlayerContext";
import { playerContent } from "./content";
import { telestrationContent } from "./telestration/content";
import { FRAME_S, SKIP_S, STEP_S } from "./useTransportHotkeys";

import { IconButton } from "@/components/forms/IconButton";

export interface PlayerTransportProps {
  readonly controller: PlayerController;
  /** Tag-capture buttons rendered on the right of the bar (from the tagging lane). */
  readonly tagControls?: ReactNode;
  /** Whether the telestration layer is up, shown as the draw switch's pressed state. */
  readonly isDrawing?: boolean;
  /** Open or close the telestration layer (P2-10); the switch is hidden without it. */
  readonly onToggleDrawing?: () => void;
}

/**
 * The transport bar directly under the video: seek/step/play controls and the
 * speed control on the left, the mono game clock in the middle, and the
 * tag-capture buttons plus the draw and fullscreen switches on the right. The
 * clock reads `M:SS / total`; tagging is injected as a slot so the player stays
 * decoupled from the tagging lane. In fullscreen the tag buttons move onto the stage, so
 * the slot arrives empty and only the switch back is left here.
 */
export function PlayerTransport({
  controller,
  tagControls,
  isDrawing = false,
  onToggleDrawing,
}: PlayerTransportProps) {
  const { gameTimeS, durationS, isPlaying } = controller;
  const formatClock = useClockFormat();
  const fullscreen = useFullscreenState();
  const { transport, fullscreen: fullscreenCopy } = playerContent;

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
        {/* Frame steps sit innermost: the controls read coarse to fine towards
            the play button. */}
        <IconButton
          name="chevron-left"
          label={transport.frameBack}
          onClick={() => controller.stepBy(-FRAME_S)}
        />
        <IconButton
          name={isPlaying ? "pause" : "play"}
          label={isPlaying ? transport.pause : transport.play}
          variant="solid"
          onClick={controller.togglePlay}
        />
        <IconButton
          name="chevron-right"
          label={transport.frameForward}
          onClick={() => controller.stepBy(FRAME_S)}
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
        {formatClock(gameTimeS)} / {formatClock(durationS)}
      </span>

      <div className="ms-auto flex items-center gap-[var(--space-3)]">
        {tagControls}
        {onToggleDrawing ? (
          <IconButton
            name="pen-tool"
            label={telestrationContent.toggle}
            active={isDrawing}
            onClick={onToggleDrawing}
          />
        ) : null}
        {/* Only the way in lives here. The way out belongs on the stage, which
            is all the coach can see once it owns the screen - a second exit
            control down here would be invisible but still in the a11y tree. */}
        {fullscreen.isActive ? null : (
          <IconButton
            name="maximize"
            label={fullscreenCopy.enter}
            disabled={!fullscreen.isSupported}
            onClick={fullscreen.toggle}
          />
        )}
      </div>
    </div>
  );
}
