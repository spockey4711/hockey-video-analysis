"use client";

import { useEffect, useRef } from "react";

import { clipEditorContent } from "../content";
import {
  HOLD_CHOICES_S,
  type MarkSettings,
  removeMark,
  setMarkSettings,
} from "../marks";

import { OutsideTrim } from "./SlowTrack";
import { TrackPlayhead, TrackSection, trackScale } from "./track";

import { cn } from "@/components/core/cn";
import { Button } from "@/components/forms/Button";
import { type ClipMark, MAX_MARKS } from "@/features/clip-edits";
import { formatClipTime } from "@/features/clip-edits/stage/slider";
import type { EditedPlayback } from "@/features/clip-edits/stage/use-edited-playback";

const { marks: copy } = clipEditorContent;

export interface MarksTrackProps {
  readonly playback: EditedPlayback;
  /** The markers, in game time. */
  readonly marks: readonly ClipMark[];
  /** The game time at clip-file time 0. */
  readonly origin: number;
  /** The entry's in and out point on the file's clock. */
  readonly inS: number;
  readonly outS: number;
  /** The selected marker's id, or null. */
  readonly selected: string | null;
  readonly onSelect: (id: string | null) => void;
  /** Store new markers. */
  readonly onChange: (marks: readonly ClipMark[]) => void;
  /** Draw a new marker at the playhead. */
  readonly onAdd: () => void;
  /** Open the drawing of `mark` again, on its frame. */
  readonly onRedraw: (mark: ClipMark) => void;
}

/**
 * The markers track (ADR 0011, D6): the clip's markers as points over the
 * whole clip, a running one with a bar as long as it shows. "Markierung
 * hinzufügen" (or `d`) pauses on the frame and puts the drawing tools up;
 * choosing a marker shows its frame with the marker on it, and offers its
 * hold time, whether the picture stands still meanwhile, drawing it again and
 * deleting it. Playing ends the selection, to show the markers as viewers
 * will see them.
 */
export function MarksTrack({
  playback,
  marks,
  origin,
  inS,
  outS,
  selected,
  onSelect,
  onChange,
  onAdd,
  onRedraw,
}: MarksTrackProps) {
  const scale = trackScale(playback.range);
  const file = (gameS: number) => gameS - origin;
  const mark = marks.find((candidate) => candidate.id === selected);

  const { isPlaying } = playback;
  const latestSelect = useRef(onSelect);
  useEffect(() => {
    latestSelect.current = onSelect;
  });
  useEffect(() => {
    if (isPlaying) latestSelect.current(null);
  }, [isPlaying]);

  function show(target: ClipMark) {
    onSelect(target.id);
    playback.pause();
    playback.seek(file(target.atS));
  }

  return (
    <TrackSection heading={copy.heading}>
      <div
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
        className="relative h-[var(--space-8)] cursor-pointer touch-pan-y rounded-[var(--radius-sm)] bg-[var(--surface)]"
      >
        {marks.map((current) =>
          current.freeze ? null : (
            <div
              key={`${current.id}-bar`}
              aria-hidden
              className="pointer-events-none absolute top-1/2 h-[var(--space-1)] -translate-y-1/2 rounded-[var(--radius-pill)] bg-[var(--accent)] opacity-60"
              style={{
                left: scale.percent(file(current.atS)),
                right: `calc(100% - ${scale.percent(file(current.atS + current.holdS))})`,
              }}
            />
          ),
        )}
        <OutsideTrim scale={scale} inS={inS} outS={outS} />
        <TrackPlayhead playback={playback} scale={scale} />
        {marks.map((current) => {
          const active = current.id === selected;
          return (
            <button
              key={current.id}
              type="button"
              aria-label={copy.mark(
                formatClipTime(file(current.atS) - scale.startS),
                current.freeze,
              )}
              aria-pressed={active}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => show(current)}
              className="absolute inset-y-0 z-10 flex w-[var(--space-5)] -translate-x-1/2 items-center justify-center rounded-[var(--radius-sm)] focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none"
              style={{ left: scale.percent(file(current.atS)) }}
            >
              <span
                aria-hidden
                className={cn(
                  "size-[var(--space-3)] rounded-full border-2",
                  active
                    ? "border-[color:var(--text-primary)] bg-[var(--accent)]"
                    : current.freeze
                      ? "border-[color:var(--accent)] bg-[var(--accent)]"
                      : "border-[color:var(--accent)] bg-[var(--surface)]",
                )}
              />
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-[var(--space-2)]">
        <Button
          variant="secondary"
          size="sm"
          iconLeft="plus"
          disabled={marks.length >= MAX_MARKS}
          onClick={onAdd}
        >
          {copy.add}
        </Button>
        {mark ? (
          <>
            <MarkSettingsControls
              settings={mark}
              onChange={(settings) =>
                onChange(setMarkSettings(marks, mark.id, settings))
              }
            />
            <Button
              variant="secondary"
              size="sm"
              iconLeft="pencil"
              onClick={() => onRedraw(mark)}
            >
              {copy.edit}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconLeft="trash-2"
              onClick={() => {
                onChange(removeMark(marks, mark.id));
                onSelect(null);
              }}
            >
              {copy.remove}
            </Button>
          </>
        ) : null}
      </div>
      <p className="text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
        {mark ? copy.selected : copy.hint}
      </p>
    </TrackSection>
  );
}

/** A marker's hold time and what the picture does meanwhile (D6). */
export function MarkSettingsControls({
  settings,
  onChange,
}: {
  settings: MarkSettings;
  onChange: (settings: MarkSettings) => void;
}) {
  return (
    <>
      <div
        role="group"
        aria-label={copy.hold}
        className="flex items-center gap-[var(--space-1)]"
      >
        {HOLD_CHOICES_S.map((holdS) => (
          <Button
            key={holdS}
            variant={settings.holdS === holdS ? "primary" : "secondary"}
            size="sm"
            aria-pressed={settings.holdS === holdS}
            onClick={() => onChange({ ...settings, holdS })}
          >
            {copy.seconds(holdS)}
          </Button>
        ))}
      </div>
      <div
        role="group"
        aria-label={copy.mode}
        className="flex items-center gap-[var(--space-1)]"
      >
        {([true, false] as const).map((freeze) => (
          <Button
            key={String(freeze)}
            variant={settings.freeze === freeze ? "primary" : "secondary"}
            size="sm"
            aria-pressed={settings.freeze === freeze}
            onClick={() => onChange({ ...settings, freeze })}
          >
            {freeze ? copy.modes.freeze : copy.modes.run}
          </Button>
        ))}
      </div>
    </>
  );
}

export interface MarkDrawPanelProps {
  readonly settings: MarkSettings;
  readonly onSettings: (settings: MarkSettings) => void;
  /** Whether the drawing holds anything to keep. */
  readonly canApply: boolean;
  readonly onApply: () => void;
  readonly onCancel: () => void;
}

/**
 * In place of the tracks while a marker is drawn: how it will show, and
 * "Übernehmen" to store the drawing at this frame or "Abbrechen" to drop it.
 */
export function MarkDrawPanel({
  settings,
  onSettings,
  canApply,
  onApply,
  onCancel,
}: MarkDrawPanelProps) {
  return (
    <TrackSection heading={copy.heading}>
      <div className="flex flex-wrap items-center gap-[var(--space-2)]">
        <MarkSettingsControls settings={settings} onChange={onSettings} />
      </div>
      <div className="flex flex-wrap items-center gap-[var(--space-2)]">
        <Button
          size="sm"
          iconLeft="check"
          disabled={!canApply}
          onClick={onApply}
        >
          {copy.apply}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {copy.cancel}
        </Button>
      </div>
      <p className="text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
        {copy.drawing}
      </p>
    </TrackSection>
  );
}
