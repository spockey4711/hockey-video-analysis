"use client";

/**
 * The floating toolbar on the stage while the coach draws (P2-10): tool and pen
 * pickers, undo and clear, the still export, and the way out. It sits on the
 * video, so it wears the fixed broadcast chrome (`--video-*` tokens) in both
 * themes, like the game clock and the fullscreen controls.
 */
import { useState, type Dispatch, type RefObject } from "react";

import { useClockFormat } from "../ClockFormatContext";
import { usePlayerController } from "../PlayerContext";

import { telestrationContent } from "./content";
import {
  downloadBlob,
  renderStill,
  StillExportFailure,
  stillFileName,
  type StillExportError,
} from "./export";
import { readDrawPalette } from "./render";
import {
  DRAW_TOOLS,
  PEN_COLORS,
  type DrawTool,
  type PenColor,
  type TelestrationAction,
  type TelestrationState,
} from "./state";

import type { IconName } from "@/components/core/Icon";
import { cn } from "@/components/core/cn";
import { IconButton } from "@/components/forms/IconButton";

export interface TelestrationToolbarProps {
  readonly state: TelestrationState;
  readonly dispatch: Dispatch<TelestrationAction>;
  readonly videoRef: RefObject<HTMLVideoElement | null>;
  readonly onClose: () => void;
}

const TOOL_ICONS: Record<DrawTool, IconName> = {
  freehand: "pencil",
  arrow: "arrow-up-right",
  circle: "circle",
};

/** Swatch fills, spelled out so Tailwind sees each `--draw-*` class. */
const SWATCH_FILL: Record<PenColor, string> = {
  red: "bg-[var(--draw-red)]",
  yellow: "bg-[var(--draw-yellow)]",
  blue: "bg-[var(--draw-blue)]",
  white: "bg-[var(--draw-white)]",
};

/** Ghost icon buttons restyled for the dark scrim pill. */
const ON_VIDEO =
  "text-[color:var(--video-ink)] hover:bg-[var(--video-control-hover)] hover:text-[color:var(--video-ink)]";
const ON_VIDEO_ACTIVE =
  "bg-[var(--video-control-active)] text-[color:var(--video-ink)] hover:bg-[var(--video-control-active)]";

function Divider() {
  return (
    <span
      aria-hidden
      className="mx-[var(--space-1)] h-[var(--space-5)] w-px bg-[var(--video-control-active)]"
    />
  );
}

export function TelestrationToolbar({
  state,
  dispatch,
  videoRef,
  onClose,
}: TelestrationToolbarProps) {
  const { gameTimeS } = usePlayerController();
  const formatClock = useClockFormat();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<StillExportError | null>(null);
  const copy = telestrationContent;
  const hasStrokes = state.strokes.length > 0;

  async function exportStill(): Promise<void> {
    const video = videoRef.current;
    if (!video || isExporting) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const blob = await renderStill(
        video,
        state.strokes,
        readDrawPalette(video),
      );
      downloadBlob(blob, stillFileName(formatClock(gameTimeS)));
    } catch (error) {
      setExportError(
        error instanceof StillExportFailure ? error.reason : "failed",
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[var(--space-4)] flex flex-col items-center gap-[var(--space-2)] px-[var(--space-4)]">
      <div
        role="toolbar"
        aria-label={copy.toolbar}
        className="pointer-events-auto flex flex-wrap items-center justify-center gap-[var(--space-1)] rounded-[var(--radius-md)] bg-[var(--video-panel)] p-[var(--space-1)] backdrop-blur-sm"
      >
        {DRAW_TOOLS.map((tool) => (
          <IconButton
            key={tool}
            name={TOOL_ICONS[tool]}
            label={copy.tools[tool]}
            active={state.tool === tool}
            onClick={() => dispatch({ type: "setTool", tool })}
            className={cn(ON_VIDEO, state.tool === tool && ON_VIDEO_ACTIVE)}
          />
        ))}

        <Divider />

        {PEN_COLORS.map((color) => {
          const selected = state.color === color;
          return (
            <button
              key={color}
              type="button"
              aria-label={copy.color(copy.colors[color])}
              title={copy.color(copy.colors[color])}
              aria-pressed={selected}
              onClick={() => dispatch({ type: "setColor", color })}
              className={cn(
                "inline-flex size-[var(--control-md)] items-center justify-center rounded-[var(--radius-md)] transition duration-[var(--dur-fast)] ease-[var(--ease-out)] focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none",
                selected
                  ? "bg-[var(--video-control-active)]"
                  : "hover:bg-[var(--video-control-hover)]",
              )}
            >
              <span
                className={cn(
                  "size-[var(--space-4)] rounded-full border-2",
                  SWATCH_FILL[color],
                  selected
                    ? "border-[color:var(--video-ink)]"
                    : "border-[color:var(--video-control-active)]",
                )}
              />
            </button>
          );
        })}

        <Divider />

        <IconButton
          name="undo-2"
          label={copy.undo}
          disabled={!hasStrokes}
          onClick={() => dispatch({ type: "undo" })}
          className={ON_VIDEO}
        />
        <IconButton
          name="trash-2"
          label={copy.clear}
          disabled={!hasStrokes}
          onClick={() => dispatch({ type: "clear" })}
          className={ON_VIDEO}
        />
        <IconButton
          name={isExporting ? "loader" : "download"}
          label={isExporting ? copy.exporting : copy.export}
          disabled={isExporting}
          onClick={() => void exportStill()}
          className={ON_VIDEO}
        />

        <Divider />

        <IconButton
          name="x"
          label={copy.close}
          onClick={onClose}
          className={ON_VIDEO}
        />
      </div>

      {exportError ? (
        <p
          role="alert"
          className="pointer-events-auto rounded-[var(--radius-md)] bg-[var(--video-panel)] px-[var(--space-3)] py-[var(--space-2)] text-center text-[length:var(--fs-body-sm)] text-[color:var(--video-ink)]"
        >
          {copy.errors[exportError]}
        </p>
      ) : null}
    </div>
  );
}
