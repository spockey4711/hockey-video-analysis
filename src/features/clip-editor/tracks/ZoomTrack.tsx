"use client";

import { useEffect, useRef } from "react";

import { clipEditorContent } from "../content";
import {
  addZoomKey,
  DEFAULT_ZOOM,
  isFullPicture,
  moveZoomKey,
  removeZoomKey,
  setZoomEase,
  setZoomRect,
} from "../zoom";

import { OutsideTrim } from "./SlowTrack";
import { TrackHandle, TrackPlayhead, TrackSection, trackScale } from "./track";

import { cn } from "@/components/core/cn";
import { Button } from "@/components/forms/Button";
import {
  FULL_PICTURE,
  type TimeRange,
  ZOOM_EASES,
  type ZoomKey,
  zoomAt,
} from "@/features/clip-edits";
import type { EditedPlayback } from "@/features/clip-edits/stage/use-edited-playback";

const { zoom: copy } = clipEditorContent;

export interface ZoomTrackProps {
  readonly playback: EditedPlayback;
  /** The zoom keyframes, in game time. */
  readonly zoom: readonly ZoomKey[];
  /** The clip window, in game time: where keyframes can go. */
  readonly window: TimeRange;
  /** The game time at clip-file time 0. */
  readonly origin: number;
  /** The entry's in and out point on the file's clock. */
  readonly inS: number;
  readonly outS: number;
  /** The selected keyframe's index, or null. */
  readonly selected: number | null;
  readonly onSelect: (index: number | null) => void;
  /** Store new keyframes, selecting the one at `select` when given. */
  readonly onChange: (zoom: readonly ZoomKey[], select?: number) => void;
}

/**
 * The zoom track (ADR 0011): the clip's zoom keyframes as points over the
 * whole clip. "Zoom hier setzen" adds one at the playhead with the crop shown
 * there (or a 2x zoom on the centre), and selects it; while one is selected
 * the stage shows the whole picture with its crop as a frame to drag. A
 * keyframe holds its crop until the next one, or glides to it; one keyframe
 * alone zooms the whole clip. Playing ends the selection, to show the zoom as
 * viewers will see it.
 */
export function ZoomTrack({
  playback,
  zoom,
  window,
  origin,
  inS,
  outS,
  selected,
  onSelect,
  onChange,
}: ZoomTrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scale = trackScale(playback.range);
  const file = (gameS: number) => gameS - origin;
  const game = (fileS: number) => fileS + origin;
  const key = selected === null ? undefined : zoom[selected];
  const isLast = selected !== null && selected === zoom.length - 1;

  const { isPlaying } = playback;
  const latestSelect = useRef(onSelect);
  useEffect(() => {
    latestSelect.current = onSelect;
  });
  useEffect(() => {
    if (isPlaying) latestSelect.current(null);
  }, [isPlaying]);

  function show(index: number, keys: readonly ZoomKey[]) {
    playback.pause();
    playback.seek(file(keys[index].atS));
  }

  function addHere() {
    const atS = game(playback.playhead.get());
    const current = zoomAt(zoom, atS);
    const added = addZoomKey(
      zoom,
      atS,
      isFullPicture(current) ? DEFAULT_ZOOM : current,
      window,
    );
    if (!added) return;
    onChange(added.zoom, added.index);
    show(added.index, added.zoom);
  }

  return (
    <TrackSection heading={copy.heading}>
      <div
        ref={trackRef}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          onSelect(null);
          playback.seek(scale.fileAt(event.clientX, event.currentTarget));
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            playback.seek(scale.fileAt(event.clientX, event.currentTarget));
          }
        }}
        className="relative h-[var(--space-8)] cursor-pointer touch-pan-y rounded-[var(--radius-sm)] bg-[var(--surface-inset)]"
      >
        {zoom.slice(0, -1).map((from, index) => (
          <div
            key={index}
            aria-hidden
            className={cn(
              "pointer-events-none absolute top-1/2 h-[var(--space-1)] -translate-y-1/2",
              from.ease === "glide"
                ? "bg-[linear-gradient(to_right,var(--border-strong),var(--accent))]"
                : "bg-[var(--border-strong)]",
            )}
            style={{
              left: scale.percent(file(from.atS)),
              right: `calc(100% - ${scale.percent(file(zoom[index + 1].atS))})`,
            }}
          />
        ))}
        <OutsideTrim scale={scale} inS={inS} outS={outS} />
        <TrackPlayhead playback={playback} scale={scale} />
        {zoom.map((zoomKey, index) => {
          const active = index === selected;
          const full = isFullPicture(zoomKey.rect);
          return (
            <TrackHandle
              key={index}
              label={copy.key(zoomKey.rect.w)}
              valueS={file(zoomKey.atS)}
              minS={playback.range.startS}
              maxS={playback.range.endS}
              trackRef={trackRef}
              scale={scale}
              onGrab={() => {
                onSelect(index);
                show(index, zoom);
              }}
              onMove={(fileS) => {
                const moved = moveZoomKey(zoom, index, game(fileS), window);
                onChange(moved, index);
                show(index, moved);
              }}
              className="cursor-grab"
            >
              <span
                aria-hidden
                className={cn(
                  "size-[var(--space-3)] rotate-45 rounded-[var(--radius-xs)] border-2",
                  active
                    ? "border-[color:var(--text-primary)] bg-[var(--accent)]"
                    : full
                      ? "border-[color:var(--accent)] bg-[var(--surface-inset)]"
                      : "border-[color:var(--accent)] bg-[var(--accent)]",
                )}
              />
            </TrackHandle>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-[var(--space-2)]">
        <Button variant="secondary" size="sm" iconLeft="plus" onClick={addHere}>
          {copy.add}
        </Button>
        {key && selected !== null ? (
          <>
            <div
              role="group"
              aria-label={copy.ease}
              className="flex items-center gap-[var(--space-1)]"
            >
              {ZOOM_EASES.map((ease) => (
                <Button
                  key={ease}
                  variant={key.ease === ease ? "primary" : "secondary"}
                  size="sm"
                  aria-pressed={key.ease === ease}
                  disabled={isLast}
                  onClick={() => onChange(setZoomEase(zoom, selected, ease))}
                >
                  {copy.eases[ease]}
                </Button>
              ))}
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={isFullPicture(key.rect)}
              onClick={() =>
                onChange(setZoomRect(zoom, selected, FULL_PICTURE))
              }
            >
              {copy.full}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconLeft="trash-2"
              onClick={() => {
                onChange(removeZoomKey(zoom, selected));
                onSelect(null);
              }}
            >
              {copy.remove}
            </Button>
          </>
        ) : null}
      </div>
      <p className="text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
        {key ? copy.editing : copy.hint}
      </p>
    </TrackSection>
  );
}
