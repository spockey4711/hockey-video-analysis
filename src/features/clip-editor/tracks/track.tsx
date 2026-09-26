"use client";

/**
 * Building blocks of the editor's tracks under the stage (trim, slow motion,
 * zoom): each track spans the stage's scrub range, shows the playhead, and
 * carries handles a pointer drags along it or the keys move.
 */
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";

import { PanelHeader } from "@/components/core/PanelHeader";
import { cn } from "@/components/core/cn";
import { usePlayheadS } from "@/features/clip-edits/stage/StageScrubBar";
import {
  formatClipTime,
  fractionAt,
  sliderKeyTarget,
} from "@/features/clip-edits/stage/slider";
import type {
  EditedPlayback,
  FileRange,
} from "@/features/clip-edits/stage/use-edited-playback";

/** Seconds a Shift or Page key moves a handle; an arrow key moves it a frame. */
const HANDLE_LARGE_STEP_S = 1;

/** Where clip-file times sit along a track over `range`. */
export interface TrackScale {
  readonly startS: number;
  readonly lengthS: number;
  /** A clip-file time as a CSS offset from the track's left edge. */
  readonly percent: (fileS: number) => string;
  /** The clip-file time under `clientX` on the track `element`. */
  readonly fileAt: (clientX: number, element: Element) => number;
}

export function trackScale({ startS, endS }: FileRange): TrackScale {
  const lengthS = Math.max(endS - startS, 0.001);
  return {
    startS,
    lengthS,
    percent: (fileS) =>
      `${(Math.min(Math.max((fileS - startS) / lengthS, 0), 1) * 100).toFixed(3)}%`,
    fileAt: (clientX, element) =>
      startS + fractionAt(clientX, element.getBoundingClientRect()) * lengthS,
  };
}

/** The playhead's line across a track. */
export function TrackPlayhead({
  playback,
  scale,
}: {
  playback: EditedPlayback;
  scale: TrackScale;
}) {
  const fileS = usePlayheadS(playback);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 z-20 w-0.5 -translate-x-1/2 bg-[var(--text-primary)]"
      style={{ left: scale.percent(fileS) }}
    />
  );
}

/** A track's heading and hint row over its body, as one labelled section. */
export function TrackSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={heading}
      className="flex flex-col gap-[var(--space-2)] border-t border-[color:var(--border)] px-[var(--space-3)] py-[var(--space-3)]"
    >
      <PanelHeader title={heading} />
      {children}
    </section>
  );
}

export interface TrackHandleProps {
  readonly label: string;
  readonly valueS: number;
  readonly minS: number;
  readonly maxS: number;
  readonly trackRef: RefObject<HTMLDivElement | null>;
  readonly scale: TrackScale;
  /** Seconds one frame of the clip lasts: how far an arrow key moves the handle. */
  readonly frameS: number;
  /** Move the handle to a clip-file time; the owner keeps it in bounds. */
  readonly onMove: (fileS: number) => void;
  /**
   * The pointer took hold of the handle, or the keyboard moved to it: e.g. to
   * select what it belongs to.
   */
  readonly onGrab?: () => void;
  readonly className?: string;
  readonly children?: ReactNode;
}

/**
 * One point on a track: a slider the pointer drags along it or the keys move,
 * read out as clip time from the start of the track.
 */
export function TrackHandle({
  label,
  valueS,
  minS,
  maxS,
  trackRef,
  scale,
  frameS,
  onMove,
  onGrab,
  className,
  children,
}: TrackHandleProps) {
  function moveTo(event: PointerEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (track) onMove(scale.fileAt(event.clientX, track));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = sliderKeyTarget(
      event.key,
      event.shiftKey,
      valueS,
      minS,
      maxS,
      { small: frameS, large: HANDLE_LARGE_STEP_S },
    );
    if (target === null) return;
    event.preventDefault();
    onMove(target);
  }

  const relative = (fileS: number) => Number((fileS - scale.startS).toFixed(2));
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={relative(minS)}
      aria-valuemax={relative(maxS)}
      aria-valuenow={relative(valueS)}
      aria-valuetext={formatClipTime(valueS - scale.startS)}
      onPointerDown={(event) => {
        // The handle, not the track under it, takes this drag.
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        onGrab?.();
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          moveTo(event);
        }
      }}
      onKeyDown={onKeyDown}
      onFocus={onGrab}
      className={cn(
        "absolute inset-y-0 z-10 flex w-[var(--space-5)] -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center rounded-[var(--radius-sm)] focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none",
        className,
      )}
      style={{ left: scale.percent(valueS) }}
    >
      {children ?? (
        <span
          aria-hidden
          className="h-full w-[var(--space-2)] rounded-[var(--radius-xs)] bg-[var(--accent)]"
        />
      )}
    </div>
  );
}
