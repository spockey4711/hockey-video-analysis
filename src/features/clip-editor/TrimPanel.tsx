"use client";

import { useEffect, useRef } from "react";

import { clipEditorContent } from "./content";
import type { EditorEntry } from "./entries";
import {
  TrackHandle,
  TrackPlayhead,
  TrackSection,
  trackScale,
} from "./tracks/track";
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
import { formatClipTime } from "@/features/clip-edits/stage/slider";
import type { EditedPlayback } from "@/features/clip-edits/stage/use-edited-playback";
import { isEditableTarget } from "@/features/player/useTransportHotkeys";

const { trim: copy, lengthen: lengthenCopy } = clipEditorContent;

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
          current.stepBy(-current.frameS);
          break;
        case "n":
          current.stepBy(current.frameS);
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
    <TrackSection heading={copy.heading}>
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
            onClick={() => setEdge("in", trim.startS - playback.frameS)}
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
            onClick={() => setEdge("in", trim.startS + playback.frameS)}
          />
        </div>
        <div className="flex items-center gap-[var(--space-1)]">
          <IconButton
            name="step-back"
            label={copy.outBack}
            onClick={() => setEdge("out", trim.endS - playback.frameS)}
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
            onClick={() => setEdge("out", trim.endS + playback.frameS)}
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
    </TrackSection>
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
  const scale = trackScale(playback.range);
  const { endS } = playback.range;

  return (
    <div
      ref={trackRef}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        playback.seek(scale.fileAt(event.clientX, event.currentTarget));
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          playback.seek(scale.fileAt(event.clientX, event.currentTarget));
        }
      }}
      className="relative h-[var(--space-10)] cursor-pointer touch-pan-y rounded-[var(--radius-sm)] bg-[var(--surface)]"
    >
      <div
        aria-hidden
        className="absolute inset-y-0 rounded-[var(--radius-sm)] border-y-2 border-[color:var(--accent)] bg-[var(--surface-raised)]"
        style={{
          left: scale.percent(inS),
          right: `calc(100% - ${scale.percent(outS)})`,
        }}
      />
      <TrackPlayhead playback={playback} scale={scale} />
      <TrackHandle
        label={copy.inHandle}
        valueS={inS}
        minS={scale.startS}
        maxS={outS}
        trackRef={trackRef}
        scale={scale}
        frameS={playback.frameS}
        onMove={(fileS) => onMove("in", fileS)}
      />
      <TrackHandle
        label={copy.outHandle}
        valueS={outS}
        minS={inS}
        maxS={endS}
        trackRef={trackRef}
        scale={scale}
        frameS={playback.frameS}
        onMove={(fileS) => onMove("out", fileS)}
      />
    </div>
  );
}
