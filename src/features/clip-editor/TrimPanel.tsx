"use client";

import {
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  useEffect,
  useRef,
} from "react";

import { clipEditorContent } from "./content";
import type { EditorEntry } from "./entries";
import {
  lengthenWindow,
  moveEdge,
  type TrimEdge,
  type WindowSide,
  withTrim,
} from "./trim";

import { Button } from "@/components/forms/Button";
import { IconButton } from "@/components/forms/IconButton";
import {
  type ClipEdit,
  type PlaybackPlan,
  toFileS,
  toGameS,
} from "@/features/clip-edits";
import { usePlayheadS } from "@/features/clip-edits/stage/StageScrubBar";
import {
  formatClipTime,
  fractionAt,
  sliderKeyTarget,
} from "@/features/clip-edits/stage/slider";
import type { EditedPlayback } from "@/features/clip-edits/stage/use-edited-playback";
import {
  FRAME_S,
  isEditableTarget,
} from "@/features/player/useTransportHotkeys";

const { trim: copy, lengthen: lengthenCopy } = clipEditorContent;

/** Arrow keys move a handle a frame, Shift or Page keys a second. */
const HANDLE_STEPS = { small: FRAME_S, large: 1 } as const;

export interface TrimPanelProps {
  readonly playback: EditedPlayback;
  readonly entry: EditorEntry;
  readonly edit: ClipEdit | null;
  /** The entry's plan under `edit`: its in and out point on the file's clock. */
  readonly plan: PlaybackPlan;
  readonly onEdit: (edit: ClipEdit | null) => void;
  readonly onLengthen: (side: WindowSide) => void;
  /** A lengthening is on its way to the server. */
  readonly lengthening: boolean;
  readonly lengthenFailed: boolean;
}

/**
 * The editor's trim controls under the stage: a track over the whole clip
 * with a handle for the in and one for the out point, the playhead on it, and
 * buttons to set either point at the playhead, nudge it by a frame, or play
 * the whole clip again. Moving a point shows its frame. "Mehr Vorlauf" and
 * "Mehr Nachlauf" reach past the clip file and so re-cut the clip (D2).
 *
 * Keys, while no text field has focus: Space plays, B and N step a frame,
 * I and O set the in and out point at the playhead.
 */
export function TrimPanel({
  playback,
  entry,
  edit,
  plan,
  onEdit,
  onLengthen,
  lengthening,
  lengthenFailed,
}: TrimPanelProps) {
  const clipWindow = entry.window;
  const origin = entry.cutStartS ?? clipWindow.startS;
  const game = (fileS: number) => toGameS(fileS, origin);
  // The trim as it plays, already fitted to the current clip.
  const trim = { startS: game(plan.inS), endS: game(plan.outS) };
  const { startS: rangeStartS } = playback.range;

  function setEdge(edge: TrimEdge, gameS: number) {
    const next = moveEdge(trim, clipWindow, edge, gameS);
    onEdit(withTrim(edit, next, clipWindow));
    // Show the point's frame, held still.
    playback.pause();
    playback.seek(toFileS(edge === "in" ? next.startS : next.endS, origin));
  }

  const latest = useRef({ playback, setEdge, game });
  useEffect(() => {
    latest.current = { playback, setEdge, game };
  });
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      const { playback: current, setEdge: set, game: toGame } = latest.current;
      const atPlayhead = toGame(current.playhead.get());
      switch (event.key.length === 1 ? event.key.toLowerCase() : event.key) {
        case " ":
          current.togglePlay();
          break;
        case "b":
          current.stepBy(-FRAME_S);
          break;
        case "n":
          current.stepBy(FRAME_S);
          break;
        case "i":
          set("in", atPlayhead);
          break;
        case "o":
          set("out", atPlayhead);
          break;
        default:
          return;
      }
      event.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const relative = (fileS: number) => formatClipTime(fileS - rangeStartS);
  const canGrowBefore =
    lengthenWindow(clipWindow, "before", entry.gameDurationS) !== null;
  const canGrowAfter =
    lengthenWindow(clipWindow, "after", entry.gameDurationS) !== null;

  return (
    <section
      aria-label={copy.heading}
      className="flex flex-col gap-[var(--space-3)] border-t border-[color:var(--border)] px-[var(--space-3)] py-[var(--space-3)]"
    >
      <TrimTrack
        playback={playback}
        inS={plan.inS}
        outS={plan.outS}
        onMove={(edge, fileS) => setEdge(edge, game(fileS))}
      />

      <p className="font-[family-name:var(--font-mono)] text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)] tabular-nums">
        {copy.start} {relative(plan.inS)} - {copy.end} {relative(plan.outS)} -{" "}
        {copy.length} {formatClipTime(plan.outS - plan.inS)}
      </p>

      <div className="flex flex-wrap items-center gap-[var(--space-2)]">
        <div className="flex items-center gap-[var(--space-1)]">
          <IconButton
            name="step-back"
            label={copy.inBack}
            onClick={() => setEdge("in", trim.startS - FRAME_S)}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEdge("in", game(playback.playhead.get()))}
          >
            {copy.setIn}
          </Button>
          <IconButton
            name="step-forward"
            label={copy.inForward}
            onClick={() => setEdge("in", trim.startS + FRAME_S)}
          />
        </div>
        <div className="flex items-center gap-[var(--space-1)]">
          <IconButton
            name="step-back"
            label={copy.outBack}
            onClick={() => setEdge("out", trim.endS - FRAME_S)}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEdge("out", game(playback.playhead.get()))}
          >
            {copy.setOut}
          </Button>
          <IconButton
            name="step-forward"
            label={copy.outForward}
            onClick={() => setEdge("out", trim.endS + FRAME_S)}
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          iconLeft="undo-2"
          disabled={!edit?.trim}
          onClick={() => onEdit(withTrim(edit, null, clipWindow))}
        >
          {copy.reset}
        </Button>
      </div>

      {plan.trimClamped ? (
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--warning)]">
          {copy.clamped}
        </p>
      ) : null}
      {plan.exact ? null : (
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {copy.inexact}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-[var(--space-2)]">
        <Button
          variant="secondary"
          size="sm"
          iconLeft="plus"
          disabled={lengthening || !canGrowBefore}
          onClick={() => onLengthen("before")}
        >
          {lengthenCopy.before}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          iconLeft="plus"
          disabled={lengthening || !canGrowAfter}
          onClick={() => onLengthen("after")}
        >
          {lengthenCopy.after}
        </Button>
      </div>
      <p className="text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
        {lengthenFailed ? (
          <span role="alert" className="text-[color:var(--danger)]">
            {lengthenCopy.failed}{" "}
          </span>
        ) : null}
        {lengthenCopy.hint}
      </p>
      <p className="hidden text-[length:var(--fs-caption)] text-[color:var(--text-muted)] md:block">
        {clipEditorContent.keys}
      </p>
    </section>
  );
}

interface TrimTrackProps {
  readonly playback: EditedPlayback;
  readonly inS: number;
  readonly outS: number;
  readonly onMove: (edge: TrimEdge, fileS: number) => void;
}

/**
 * The track over the whole clip: the kept stretch between the two handles,
 * the rest dimmed, and the playhead. Pressing the track moves the playhead;
 * dragging a handle, or its arrow keys, moves that point.
 */
function TrimTrack({ playback, inS, outS, onMove }: TrimTrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const fileS = usePlayheadS(playback);
  const { startS, endS } = playback.range;
  const lengthS = Math.max(endS - startS, 0.001);
  const percent = (s: number) =>
    `${(Math.min(Math.max((s - startS) / lengthS, 0), 1) * 100).toFixed(3)}%`;

  function seekAt(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    playback.seek(startS + fractionAt(event.clientX, rect) * lengthS);
  }

  return (
    <div
      ref={trackRef}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        seekAt(event);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          seekAt(event);
        }
      }}
      className="relative h-[var(--space-10)] cursor-pointer touch-pan-y rounded-[var(--radius-sm)] bg-[var(--surface-inset)]"
    >
      <div
        aria-hidden
        className="absolute inset-y-0 rounded-[var(--radius-sm)] border-y-2 border-[color:var(--accent)] bg-[var(--surface-raised)]"
        style={{ left: percent(inS), right: `calc(100% - ${percent(outS)})` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-[var(--text-primary)]"
        style={{ left: percent(fileS) }}
      />
      <TrimHandle
        edge="in"
        label={copy.inHandle}
        valueS={inS}
        minS={startS}
        maxS={outS}
        trackRef={trackRef}
        percent={percent(inS)}
        range={{ startS, lengthS }}
        onMove={onMove}
      />
      <TrimHandle
        edge="out"
        label={copy.outHandle}
        valueS={outS}
        minS={inS}
        maxS={endS}
        trackRef={trackRef}
        percent={percent(outS)}
        range={{ startS, lengthS }}
        onMove={onMove}
      />
    </div>
  );
}

interface TrimHandleProps {
  readonly edge: TrimEdge;
  readonly label: string;
  readonly valueS: number;
  readonly minS: number;
  readonly maxS: number;
  readonly trackRef: RefObject<HTMLDivElement | null>;
  readonly percent: string;
  readonly range: { readonly startS: number; readonly lengthS: number };
  readonly onMove: (edge: TrimEdge, fileS: number) => void;
}

/** One trim point: a slider the pointer drags along the track or the keys move. */
function TrimHandle({
  edge,
  label,
  valueS,
  minS,
  maxS,
  trackRef,
  percent,
  range,
  onMove,
}: TrimHandleProps) {
  function moveTo(event: PointerEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (!track) return;
    const fraction = fractionAt(event.clientX, track.getBoundingClientRect());
    onMove(edge, range.startS + fraction * range.lengthS);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = sliderKeyTarget(
      event.key,
      event.shiftKey,
      valueS,
      minS,
      maxS,
      HANDLE_STEPS,
    );
    if (target === null) return;
    event.preventDefault();
    onMove(edge, target);
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={Number((minS - range.startS).toFixed(2))}
      aria-valuemax={Number((maxS - range.startS).toFixed(2))}
      aria-valuenow={Number((valueS - range.startS).toFixed(2))}
      aria-valuetext={formatClipTime(valueS - range.startS)}
      onPointerDown={(event) => {
        // The handle, not the track under it, takes this drag.
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          moveTo(event);
        }
      }}
      onKeyDown={onKeyDown}
      className="absolute inset-y-0 z-10 flex w-[var(--space-5)] -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center rounded-[var(--radius-sm)] focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none"
      style={{ left: percent }}
    >
      <span
        aria-hidden
        className="h-full w-[var(--space-2)] rounded-[var(--radius-xs)] bg-[var(--accent)]"
      />
    </div>
  );
}
