"use client";

import { type PointerEvent, useRef, useState } from "react";

import { clipEditorContent } from "../content";
import {
  addSlowRange,
  DEFAULT_SLOW_S,
  moveSlowEdge,
  removeSlowRange,
  setSlowRate,
  slowRangeAt,
} from "../slow";

import {
  TrackHandle,
  TrackPlayhead,
  TrackSection,
  trackScale,
  type TrackScale,
} from "./track";

import { cn } from "@/components/core/cn";
import { Button } from "@/components/forms/Button";
import {
  SLOW_RATES,
  type SlowRange,
  type TimeRange,
} from "@/features/clip-edits";
import { formatClipTime } from "@/features/clip-edits/stage/slider";
import type { EditedPlayback } from "@/features/clip-edits/stage/use-edited-playback";

const { slow: copy } = clipEditorContent;

/** A press that moves less than this many pixels is a click, not a drag. */
const DRAG_PX = 4;

export interface SlowTrackProps {
  readonly playback: EditedPlayback;
  /** The slow-motion ranges, in game time. */
  readonly slow: readonly SlowRange[];
  /** The clip window, in game time: where ranges can go. */
  readonly window: TimeRange;
  /** The game time at clip-file time 0. */
  readonly origin: number;
  /** The entry's in and out point on the file's clock, outside which nothing plays. */
  readonly inS: number;
  readonly outS: number;
  /** The selected range's index, or null. */
  readonly selected: number | null;
  readonly onSelect: (index: number | null) => void;
  /** Store new ranges, selecting the one at `select` when given. */
  readonly onChange: (slow: readonly SlowRange[], select?: number) => void;
}

/** A range being drawn by a drag, in clip-file seconds. */
interface Drawing {
  readonly pointerId: number;
  readonly fromS: number;
  readonly toS: number;
  readonly fromX: number;
  readonly moved: boolean;
}

/**
 * The slow-motion track (ADR 0011, D5): the clip's slow stretches as blocks
 * over the whole clip. A drag across free track draws a new one at half speed;
 * a click moves the playhead. Choosing a block shows its handles to move its
 * start and end, and lets the coach pick its speed or remove it. Slow motion
 * plays muted.
 */
export function SlowTrack({
  playback,
  slow,
  window,
  origin,
  inS,
  outS,
  selected,
  onSelect,
  onChange,
}: SlowTrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drawing | null>(null);
  const [drawing, setDrawing] = useState<Drawing | null>(null);
  const scale = trackScale(playback.range);
  const file = (gameS: number) => gameS - origin;
  const game = (fileS: number) => fileS + origin;
  const range = selected === null ? undefined : slow[selected];
  const rateLabel = (rate: number) =>
    copy.rates[rate === 0.25 ? "quarter" : "half"];

  function add(fromS: number, toS: number) {
    const added = addSlowRange(slow, game(fromS), game(toS), window);
    if (!added) return;
    onChange(added.slow, added.index);
    playback.pause();
    playback.seek(file(added.slow[added.index].startS));
  }

  // The drag lives in a ref, so a release in the same frame as the last move
  // still sees it; the state only draws the range being dragged.
  function draw(next: Drawing | null) {
    dragRef.current = next;
    setDrawing(next);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const atS = scale.fileAt(event.clientX, event.currentTarget);
    draw({
      pointerId: event.pointerId,
      fromS: atS,
      toS: atS,
      fromX: event.clientX,
      moved: false,
    });
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = dragRef.current;
    if (current?.pointerId !== event.pointerId) return;
    draw({
      ...current,
      toS: scale.fileAt(event.clientX, event.currentTarget),
      moved: current.moved || Math.abs(event.clientX - current.fromX) > DRAG_PX,
    });
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const current = dragRef.current;
    if (current?.pointerId !== event.pointerId) return;
    draw(null);
    if (current.moved) {
      add(current.fromS, scale.fileAt(event.clientX, event.currentTarget));
    } else {
      onSelect(null);
      playback.seek(current.fromS);
    }
  }

  return (
    <TrackSection heading={copy.heading}>
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => draw(null)}
        className="relative h-[var(--space-8)] cursor-crosshair touch-pan-y rounded-[var(--radius-sm)] bg-[var(--surface-inset)]"
      >
        {slow.map((slowRange, index) => {
          const startS = file(slowRange.startS);
          const endS = file(slowRange.endS);
          const active = index === selected;
          return (
            <button
              key={`${slowRange.startS}-${index}`}
              type="button"
              aria-pressed={active}
              aria-label={copy.range(
                rateLabel(slowRange.rate),
                formatClipTime(startS - scale.startS),
                formatClipTime(endS - scale.startS),
              )}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                onSelect(index);
                playback.pause();
                playback.seek(startS);
              }}
              className={cn(
                "absolute inset-y-[var(--space-1)] flex items-center justify-center overflow-hidden rounded-[var(--radius-xs)] border text-[length:var(--fs-caption)] whitespace-nowrap focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none",
                active
                  ? "border-[color:var(--accent)] bg-[var(--accent)] text-[color:var(--accent-ink)]"
                  : "border-[color:var(--accent)] bg-[var(--surface-raised)] text-[color:var(--text-brand)]",
              )}
              style={{
                left: scale.percent(startS),
                right: `calc(100% - ${scale.percent(endS)})`,
              }}
            >
              {rateLabel(slowRange.rate)}
            </button>
          );
        })}
        {drawing?.moved ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-[var(--space-1)] rounded-[var(--radius-xs)] border border-dashed border-[color:var(--accent)]"
            style={{
              left: scale.percent(Math.min(drawing.fromS, drawing.toS)),
              right: `calc(100% - ${scale.percent(Math.max(drawing.fromS, drawing.toS))})`,
            }}
          />
        ) : null}
        <OutsideTrim scale={scale} inS={inS} outS={outS} />
        <TrackPlayhead playback={playback} scale={scale} />
        {range && selected !== null ? (
          <>
            <TrackHandle
              label={copy.startHandle}
              valueS={file(range.startS)}
              minS={scale.startS}
              maxS={file(range.endS)}
              trackRef={trackRef}
              scale={scale}
              onMove={(fileS) => {
                onChange(
                  moveSlowEdge(slow, selected, "start", game(fileS), window),
                );
                playback.pause();
                playback.seek(fileS);
              }}
            />
            <TrackHandle
              label={copy.endHandle}
              valueS={file(range.endS)}
              minS={file(range.startS)}
              maxS={playback.range.endS}
              trackRef={trackRef}
              scale={scale}
              onMove={(fileS) => {
                onChange(
                  moveSlowEdge(slow, selected, "end", game(fileS), window),
                );
                playback.pause();
                playback.seek(fileS);
              }}
            />
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-[var(--space-2)]">
        <Button
          variant="secondary"
          size="sm"
          iconLeft="plus"
          onClick={() => {
            const atS = playback.playhead.get();
            // Inside a slow stretch already: choose that one instead.
            const inside = slowRangeAt(slow, game(atS));
            if (inside >= 0) onSelect(inside);
            else add(atS, atS + DEFAULT_SLOW_S);
          }}
        >
          {copy.add}
        </Button>
        {range && selected !== null ? (
          <>
            <div
              role="group"
              aria-label={copy.rate}
              className="flex items-center gap-[var(--space-1)]"
            >
              {SLOW_RATES.map((rate) => (
                <Button
                  key={rate}
                  variant={range.rate === rate ? "primary" : "secondary"}
                  size="sm"
                  aria-pressed={range.rate === rate}
                  onClick={() => onChange(setSlowRate(slow, selected, rate))}
                >
                  {rateLabel(rate)}
                </Button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              iconLeft="trash-2"
              onClick={() => {
                onChange(removeSlowRange(slow, selected));
                onSelect(null);
              }}
            >
              {copy.remove}
            </Button>
          </>
        ) : null}
      </div>
      <p className="text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
        {copy.hint}
      </p>
    </TrackSection>
  );
}

/** Dims the track outside the entry's in and out point, where nothing plays. */
export function OutsideTrim({
  scale,
  inS,
  outS,
}: {
  scale: TrackScale;
  inS: number;
  outS: number;
}) {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 rounded-l-[var(--radius-sm)] bg-[var(--scrim)]"
        style={{ width: scale.percent(inS) }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 rounded-r-[var(--radius-sm)] bg-[var(--scrim)]"
        style={{ left: scale.percent(outS) }}
      />
    </>
  );
}
