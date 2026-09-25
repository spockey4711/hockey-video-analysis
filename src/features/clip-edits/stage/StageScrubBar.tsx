"use client";

import {
  type KeyboardEvent,
  type PointerEvent,
  useSyncExternalStore,
} from "react";

import { stageContent } from "./content";
import { formatClipTime, fractionAt, sliderKeyTarget } from "./slider";
import type { EditedPlayback } from "./use-edited-playback";

/** Arrow keys move the playhead a second, Shift or Page keys five. */
const KEY_STEPS = { small: 1, large: 5 } as const;

/** Read the playhead so only the component showing it re-renders per frame. */
export function usePlayheadS(playback: EditedPlayback): number {
  const { playhead } = playback;
  return useSyncExternalStore(playhead.subscribe, playhead.get, () => 0);
}

/**
 * The stage's scrub bar over {@link EditedPlayback.range}: a slider a mouse or
 * finger drags anywhere along the bar (not only at its knob, which is small on
 * a phone) and the keyboard moves, with the position read out as clip time.
 * Built on pointer events rather than a native range input, as a native range
 * only moves from its knob on some phones. A horizontal drag scrubs while a
 * vertical swipe still scrolls the page.
 */
export function StageScrubBar({ playback }: { playback: EditedPlayback }) {
  const fileS = usePlayheadS(playback);
  const { startS, endS } = playback.range;
  const lengthS = Math.max(endS - startS, 0);
  const positionS = Math.min(Math.max(fileS - startS, 0), lengthS);
  const fraction = lengthS > 0 ? positionS / lengthS : 0;

  function seekTo(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    playback.seek(startS + fractionAt(event.clientX, rect) * lengthS);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = sliderKeyTarget(
      event.key,
      event.shiftKey,
      positionS,
      0,
      lengthS,
      KEY_STEPS,
    );
    if (target === null) return;
    // Arrows here belong to the bar, not to a surrounding clip navigation.
    event.preventDefault();
    event.stopPropagation();
    playback.seek(startS + target);
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={stageContent.scrub}
      aria-valuemin={0}
      aria-valuemax={Number(lengthS.toFixed(2))}
      aria-valuenow={Number(positionS.toFixed(2))}
      aria-valuetext={stageContent.clockLabel(
        formatClipTime(positionS),
        formatClipTime(lengthS),
      )}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        seekTo(event);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          seekTo(event);
        }
      }}
      onKeyDown={onKeyDown}
      className="group relative flex h-[var(--space-6)] w-full cursor-pointer touch-pan-y items-center rounded-[var(--radius-sm)] focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none"
    >
      <div className="absolute inset-x-0 h-[var(--space-1)] overflow-hidden rounded-[var(--radius-pill)] bg-[var(--border-strong)]">
        <div
          className="absolute inset-y-0 left-0 bg-[var(--accent)]"
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
      <div
        aria-hidden
        className="absolute size-[var(--space-3)] -translate-x-1/2 rounded-[var(--radius-pill)] bg-[var(--accent)] shadow-[var(--shadow-sm)] transition-transform duration-[var(--dur-fast)] group-hover:scale-125"
        style={{ left: `${fraction * 100}%` }}
      />
    </div>
  );
}
