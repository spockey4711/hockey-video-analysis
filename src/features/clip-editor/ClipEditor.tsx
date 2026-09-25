"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";

import { TrimPanel } from "./TrimPanel";
import { ZoomFrameHandle } from "./ZoomFrameHandle";
import { clipEditorContent } from "./content";
import type { EditorEntry } from "./entries";
import {
  DEFAULT_MARK_SETTINGS,
  type MarkSettings,
  newMarkId,
  putMark,
  withMarks,
} from "./marks";
import { EditorPickerActions } from "./picker/EditorPickerActions";
import { withSlow } from "./slow";
import { MarkDrawPanel, MarksTrack } from "./tracks/MarksTrack";
import { SlowTrack } from "./tracks/SlowTrack";
import { ZoomTrack } from "./tracks/ZoomTrack";
import {
  editAfterLengthening,
  fitEditToWindow,
  lengthenWindow,
  type WindowSide,
} from "./trim";
import { type SaveStatus, useEditDrafts } from "./use-edit-drafts";
import { setZoomRect, withZoom } from "./zoom";

import { EmptyState } from "@/components/core/EmptyState";
import { Icon } from "@/components/core/Icon";
import { cn } from "@/components/core/cn";
import { Button } from "@/components/forms/Button";
import {
  type ClipEdit,
  type ClipMark,
  FULL_PICTURE,
  type PlaybackPlan,
  toFileS,
  toGameS,
  toPlaybackPlan,
  zoomAt,
} from "@/features/clip-edits";
import {
  EditedClipStage,
  type StageControl,
} from "@/features/clip-edits/stage/EditedClipStage";
import { usePlayheadS } from "@/features/clip-edits/stage/StageScrubBar";
import type { EditedPlayback } from "@/features/clip-edits/stage/use-edited-playback";
import type { ClipStatus } from "@/features/clips/status";
import {
  type Telestration,
  TelestrationLayer,
  TelestrationToolbar,
  useTelestration,
} from "@/features/player/telestration";

export interface ClipEditorProps {
  readonly collectionId: string;
  readonly collectionName: string;
  /** The collection's share link path, to check the result as viewers see it. */
  readonly sharePath: string;
  readonly entries: readonly EditorEntry[];
  /** The clip to open with (`?clip=`); the first one when absent or unknown. */
  readonly initialClipId?: string;
}

/** How often a clip being cut is checked on, in milliseconds. */
const CUT_POLL_MS = 2000;

function isCutting(status: ClipStatus): boolean {
  return status === "pending" || status === "processing";
}

/**
 * The clip editor (ADR 0011): a full-window coach page for one collection,
 * meant to sit in its own tab beside the tagging page. The collection's clips
 * are listed on one side; the chosen one plays on the edited-clip stage as the
 * link will play it, with the trim controls under it. Every change is saved on
 * its own shortly after it is made, and the header says whether all is saved.
 *
 * Lengthening re-cuts the clip (D2): while the worker cuts it, the entry
 * shows a wait state instead of the player, and the editor checks on it until
 * the new file is ready, then reloads the entries from the server.
 */
export function ClipEditor({
  collectionId,
  collectionName,
  sharePath,
  entries,
  initialClipId,
}: ClipEditorProps) {
  const router = useRouter();
  const drafts = useEditDrafts(collectionId);
  const [selectedId, setSelectedId] = useState(
    entries.some((entry) => entry.id === initialClipId)
      ? initialClipId
      : entries[0]?.id,
  );
  // Clips sent to be re-cut here, shown as cutting until the new file is in.
  const [recutting, setRecutting] = useState<ReadonlySet<string>>(new Set());
  const [lengthening, setLengthening] = useState(false);
  const [lengthenFailed, setLengthenFailed] = useState(false);
  const [, startRefresh] = useTransition();

  const statusOf = (entry: EditorEntry): ClipStatus =>
    recutting.has(entry.id) ? "pending" : entry.status;
  const baseOf = (entry: EditorEntry) => ({
    edit: entry.edit,
    version: entry.version,
    state: "saved" as const,
  });
  const editOf = (entry: EditorEntry) =>
    drafts.draftOf(entry.id, baseOf(entry)).edit;

  // Check on clips being cut; once one is done, reload the entries and drop
  // its wait state in the same update, so the old file never flashes back.
  const cuttingIds = entries
    .filter((entry) => isCutting(statusOf(entry)))
    .map((entry) => entry.id)
    .join(",");
  const refresh = useRef(router.refresh);
  useEffect(() => {
    refresh.current = router.refresh;
  });
  useEffect(() => {
    if (!cuttingIds) return;
    const timer = setInterval(() => {
      for (const id of cuttingIds.split(",")) {
        void fetch(`/api/collections/${collectionId}/clips/${id}/edit`)
          .then((response) => (response.ok ? response.json() : null))
          .then((body: { clipStatus: ClipStatus } | null) => {
            if (!body || isCutting(body.clipStatus)) return;
            startRefresh(() => {
              refresh.current();
              setRecutting((current) => {
                const next = new Set(current);
                next.delete(id);
                return next;
              });
            });
          })
          .catch(() => {});
      }
    }, CUT_POLL_MS);
    return () => clearInterval(timer);
  }, [cuttingIds, collectionId]);

  function select(id: string) {
    setSelectedId(id);
    setLengthenFailed(false);
    window.history.replaceState(null, "", `?clip=${id}`);
  }

  async function lengthen(entry: EditorEntry, side: WindowSide) {
    const grown = lengthenWindow(entry.window, side, entry.gameDurationS);
    if (!grown) return;
    setLengthening(true);
    setLengthenFailed(false);
    try {
      const response = await fetch(`/api/tags/${entry.tagId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: entry.tagType, ...grown }),
      });
      if (!response.ok) {
        setLengthenFailed(true);
        return;
      }
      const edit = editOf(entry);
      const next = editAfterLengthening(edit, grown, side);
      if (next !== edit) drafts.change(entry.id, next, baseOf(entry));
      setRecutting((current) => new Set(current).add(entry.id));
    } catch {
      setLengthenFailed(true);
    } finally {
      setLengthening(false);
    }
  }

  const selected = entries.find((entry) => entry.id === selectedId);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--bg-app)] text-[color:var(--text-primary)] lg:h-[100dvh]">
      <header className="flex flex-wrap items-center gap-x-[var(--space-4)] gap-y-[var(--space-2)] border-b border-[color:var(--border)] px-[var(--space-4)] py-[var(--space-3)]">
        <Link
          href={`/collections/${collectionId}`}
          className="flex min-w-0 items-center gap-[var(--space-1)] text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)] underline-offset-2 hover:underline"
        >
          <Icon name="chevron-left" size={16} />
          <span className="truncate">
            {clipEditorContent.back(collectionName)}
          </span>
        </Link>
        <h1 className="font-[family-name:var(--font-display)] text-[length:var(--fs-h3)] [font-weight:var(--fw-semibold)]">
          {clipEditorContent.title}
        </h1>
        <EditorPickerActions collectionId={collectionId} onAdded={select} />
        <div className="ms-auto flex items-center gap-[var(--space-3)]">
          <SaveIndicator
            status={drafts.status}
            onReload={() => selected && void drafts.reload(selected.id)}
          />
          <a
            href={sharePath}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-[var(--space-1)] text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)] underline-offset-2 hover:underline"
          >
            {clipEditorContent.openLink}
            <Icon name="arrow-up-right" size={14} />
          </a>
        </div>
      </header>

      {entries.length === 0 ? (
        <EmptyState
          icon="film"
          title={clipEditorContent.empty.title}
          hint={clipEditorContent.empty.hint}
          className="m-auto p-[var(--space-6)]"
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <main className="flex min-w-0 flex-1 flex-col lg:overflow-y-auto">
            {selected ? (
              <EntryWorkspace
                key={`${selected.id}:${selected.src}`}
                entry={selected}
                status={statusOf(selected)}
                edit={editOf(selected)}
                onEdit={(edit) =>
                  drafts.change(
                    selected.id,
                    fitEditToWindow(edit, selected.window),
                    baseOf(selected),
                  )
                }
                onLengthen={(side) => void lengthen(selected, side)}
                lengthening={lengthening}
                lengthenFailed={lengthenFailed}
              />
            ) : null}
          </main>
          <nav
            aria-label={clipEditorContent.list.heading}
            className="border-t border-[color:var(--border)] lg:order-first lg:w-[var(--sidebar-w)] lg:shrink-0 lg:overflow-y-auto lg:border-t-0 lg:border-r"
          >
            <h2 className="px-[var(--space-4)] pt-[var(--space-3)] text-[length:var(--fs-caption)] [font-weight:var(--fw-semibold)] tracking-[var(--ls-wide)] text-[color:var(--text-secondary)] uppercase">
              {clipEditorContent.list.heading}
            </h2>
            <ol className="flex flex-col gap-[var(--space-1)] p-[var(--space-2)]">
              {entries.map((entry, index) => (
                <li key={entry.id}>
                  <EntryButton
                    entry={entry}
                    number={index + 1}
                    status={statusOf(entry)}
                    edited={editOf(entry) !== null}
                    active={entry.id === selectedId}
                    onSelect={() => select(entry.id)}
                  />
                </li>
              ))}
            </ol>
          </nav>
        </div>
      )}
    </div>
  );
}

function SaveIndicator({
  status,
  onReload,
}: {
  status: SaveStatus;
  onReload: () => void;
}) {
  const { save } = clipEditorContent;
  if (status === "conflict") {
    return (
      <span
        role="alert"
        className="flex items-center gap-[var(--space-2)] text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
      >
        {save.conflict}
        <Button variant="secondary" size="sm" onClick={onReload}>
          {save.reload}
        </Button>
      </span>
    );
  }
  return (
    <span
      role="status"
      className={cn(
        "flex items-center gap-[var(--space-1)] text-[length:var(--fs-body-sm)]",
        status === "error"
          ? "text-[color:var(--danger)]"
          : "text-[color:var(--text-muted)]",
      )}
    >
      {status === "saved" ? <Icon name="check" size={14} /> : null}
      {save[status]}
    </span>
  );
}

interface EntryButtonProps {
  readonly entry: EditorEntry;
  readonly number: number;
  readonly status: ClipStatus;
  readonly edited: boolean;
  readonly active: boolean;
  readonly onSelect: () => void;
}

function EntryButton({
  entry,
  number,
  status,
  edited,
  active,
  onSelect,
}: EntryButtonProps) {
  const { list } = clipEditorContent;
  const badge = isCutting(status)
    ? list.cutting
    : status === "failed"
      ? list.failed
      : edited
        ? list.edited
        : null;
  return (
    <button
      type="button"
      aria-current={active ? "true" : undefined}
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-[var(--space-3)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-left transition duration-[var(--dur-fast)] ease-[var(--ease-out)] focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none",
        active
          ? "bg-[var(--surface-hover)] text-[color:var(--text-primary)]"
          : "text-[color:var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[color:var(--text-primary)]",
      )}
    >
      <span className="w-[2ch] shrink-0 text-right font-[family-name:var(--font-mono)] text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)] tabular-nums">
        {number}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="flex flex-wrap items-center gap-x-[var(--space-2)] text-[length:var(--fs-body-sm)] [font-weight:var(--fw-medium)]">
          {entry.title}
          {entry.isSingle ? <Badge>{list.single}</Badge> : null}
          {badge ? (
            <Badge tone={status === "failed" ? "danger" : "accent"}>
              {badge}
            </Badge>
          ) : null}
        </span>
        <span className="truncate text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
          {entry.subtitle}
        </span>
      </span>
    </button>
  );
}

function Badge({
  children,
  tone = "muted",
}: {
  children: string;
  tone?: "muted" | "accent" | "danger";
}) {
  return (
    <span
      className={cn(
        "rounded-[var(--radius-pill)] border px-[var(--space-2)] text-[length:var(--fs-caption)] [font-weight:var(--fw-regular)]",
        tone === "muted" &&
          "border-[color:var(--border-subtle)] text-[color:var(--text-muted)]",
        tone === "accent" &&
          "border-[color:var(--accent)] text-[color:var(--text-brand)]",
        tone === "danger" &&
          "border-[color:var(--danger)] text-[color:var(--danger)]",
      )}
    >
      {children}
    </span>
  );
}

interface EntryWorkspaceProps {
  readonly entry: EditorEntry;
  readonly status: ClipStatus;
  readonly edit: ClipEdit | null;
  readonly onEdit: (edit: ClipEdit | null) => void;
  readonly onLengthen: (side: WindowSide) => void;
  readonly lengthening: boolean;
  readonly lengthenFailed: boolean;
}

/** The chosen clip: the stage with its tracks, or its cut's wait state. */
function EntryWorkspace({ status, entry, ...rest }: EntryWorkspaceProps) {
  if (status !== "ready" || entry.src === null) {
    const copy =
      status === "failed"
        ? clipEditorContent.failed
        : clipEditorContent.cutting;
    return (
      <EmptyState
        icon={status === "failed" ? "alert-triangle" : "loader"}
        title={copy.title}
        hint={copy.hint}
        role={status === "failed" ? undefined : "status"}
        className="m-auto p-[var(--space-8)]"
      />
    );
  }
  return <EntryStage entry={{ ...entry, src: entry.src }} {...rest} />;
}

/** What is chosen on a track: a slow-motion range, a zoom keyframe or a marker. */
type TrackSelection =
  | { readonly track: "slow" | "zoom"; readonly index: number }
  | { readonly track: "mark"; readonly id: string }
  | null;

/** The marker being drawn: a new one (no id) or a change to a stored one. */
interface MarkDraft extends MarkSettings {
  readonly id: string | null;
}

const NEW_MARK: MarkDraft = { id: null, ...DEFAULT_MARK_SETTINGS };

type EntryStageProps = Omit<EntryWorkspaceProps, "status"> & {
  readonly entry: EditorEntry & { readonly src: string };
};

/**
 * A ready clip on the stage with the tracks under it (length, slow motion,
 * zoom, markers). While a zoom keyframe is chosen, the stage shows the whole
 * picture with that keyframe's crop as a frame to drag.
 *
 * Drawing a marker (D6) pauses on the frame and puts the telestration tools
 * over the picture as viewers will see it, zoom included; the tracks give way
 * to the marker's settings and "Übernehmen", as anything that moves the
 * picture would drop the drawing.
 */
function EntryStage({
  entry,
  edit,
  onEdit,
  onLengthen,
  lengthening,
  lengthenFailed,
}: EntryStageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<StageControl>(null);
  const [selection, setSelection] = useState<TrackSelection>(null);
  const [showMarks, setShowMarks] = useState(true);
  const pause = useCallback(() => stageRef.current?.pause(), []);
  const telestration = useTelestration(pause, videoRef);
  const drawing = telestration.state.active;
  const [draft, setDraft] = useState<MarkDraft>(NEW_MARK);
  // A drawing that goes away (applied, cancelled, or dropped by `d`, Esc or a
  // move of the picture) leaves the next one new; one that comes up ends the
  // track selection, so the stage shows the picture as viewers see it.
  const [wasDrawing, setWasDrawing] = useState(drawing);
  if (wasDrawing !== drawing) {
    setWasDrawing(drawing);
    if (drawing) setSelection(null);
    else setDraft(NEW_MARK);
  }

  const timeline = { cutStartS: entry.cutStartS, window: entry.window };
  const plan = toPlaybackPlan(edit, timeline);
  const origin = entry.cutStartS ?? entry.window.startS;
  // Scrub over the whole clip, so a new in or out point can lie outside the trim.
  const scrubRange = {
    startS: Math.max(0, toFileS(entry.window.startS, origin)),
    endS: toFileS(entry.window.endS, origin),
  };

  const slow = edit?.slow ?? [];
  const zoom = edit?.zoom ?? [];
  const marks = edit?.marks ?? [];
  const selectedOn = (track: "slow" | "zoom") =>
    selection?.track === track ? selection.index : null;
  const zoomIndex = selectedOn("zoom");
  const zoomKey = zoomIndex === null ? undefined : zoom[zoomIndex];
  const markId = selection?.track === "mark" ? selection.id : null;
  const select = (track: "slow" | "zoom") => (index: number | null) =>
    setSelection(index === null ? null : { track, index });

  function addMark() {
    setDraft(NEW_MARK);
    telestration.open();
  }

  /** Draw `mark` again on its own frame, once the picture shows it. */
  function redraw(mark: ClipMark, playback: EditedPlayback) {
    const video = videoRef.current;
    if (!video) return;
    const target = toFileS(mark.atS, origin);
    const open = () => {
      setDraft({ id: mark.id, holdS: mark.holdS, freeze: mark.freeze });
      telestration.load(mark.strokes);
    };
    playback.pause();
    if (!video.seeking && Math.abs(video.currentTime - target) < 0.001) {
      open();
      return;
    }
    video.addEventListener("seeked", open, { once: true });
    playback.seek(target);
  }

  function applyMark(playback: EditedPlayback) {
    const { strokes } = telestration.state;
    if (strokes.length === 0) return;
    const stored = marks.find((mark) => mark.id === draft.id);
    const mark: ClipMark = {
      id: stored?.id ?? newMarkId(marks),
      atS: stored?.atS ?? toGameS(playback.playhead.get(), origin),
      holdS: draft.holdS,
      freeze: draft.freeze,
      strokes,
    };
    const next = putMark(marks, mark, entry.window);
    if (!next) return;
    onEdit(withMarks(edit, next));
    telestration.close();
    setSelection({ track: "mark", id: mark.id });
  }

  return (
    <EditedClipStage
      items={[{ id: entry.id, src: entry.src }]}
      index={0}
      // The marker being drawn again shows on the drawing layer only.
      plan={
        drawing && draft.id
          ? {
              ...plan,
              marks: plan.marks.filter((mark) => mark.id !== draft.id),
            }
          : plan
      }
      videoRef={videoRef}
      controlRef={stageRef}
      title={entry.title}
      scrubRange={scrubRange}
      // Keep the tracks in view beside a wide picture on a desktop screen.
      pictureClassName="lg:max-h-[55dvh]"
      zoom={zoomKey && !drawing ? FULL_PICTURE : undefined}
      hideTransport={drawing}
      showMarks={showMarks}
      onToggleMarks={
        marks.length > 0 ? () => setShowMarks((shown) => !shown) : undefined
      }
      pictureOverlay={(playback) =>
        drawing ? (
          <MarkDrawingLayer
            telestration={telestration}
            videoRef={videoRef}
            playback={playback}
            plan={plan}
          />
        ) : zoomKey && zoomIndex !== null ? (
          <ZoomFrameHandle
            rect={zoomKey.rect}
            onChange={(rect) =>
              onEdit(withZoom(edit, setZoomRect(zoom, zoomIndex, rect)))
            }
          />
        ) : null
      }
      below={(playback) =>
        drawing ? (
          <MarkDrawPanel
            settings={draft}
            onSettings={(settings) => setDraft({ ...draft, ...settings })}
            canApply={telestration.state.strokes.length > 0}
            onApply={() => applyMark(playback)}
            onCancel={telestration.close}
          />
        ) : (
          <>
            <TrimPanel
              playback={playback}
              entry={entry}
              edit={edit}
              plan={plan}
              onEdit={onEdit}
              onLengthen={onLengthen}
              lengthening={lengthening}
              lengthenFailed={lengthenFailed}
            />
            <SlowTrack
              playback={playback}
              slow={slow}
              window={entry.window}
              origin={origin}
              inS={plan.inS}
              outS={plan.outS}
              selected={selectedOn("slow")}
              onSelect={select("slow")}
              onChange={(next, index) => {
                onEdit(withSlow(edit, next));
                if (index !== undefined) select("slow")(index);
              }}
            />
            <ZoomTrack
              playback={playback}
              zoom={zoom}
              window={entry.window}
              origin={origin}
              inS={plan.inS}
              outS={plan.outS}
              selected={zoomIndex}
              onSelect={select("zoom")}
              onChange={(next, index) => {
                onEdit(withZoom(edit, next));
                if (index !== undefined) select("zoom")(index);
              }}
            />
            <MarksTrack
              playback={playback}
              marks={marks}
              origin={origin}
              inS={plan.inS}
              outS={plan.outS}
              selected={markId}
              onSelect={(id) =>
                setSelection(id === null ? null : { track: "mark", id })
              }
              onChange={(next) => onEdit(withMarks(edit, next))}
              onAdd={addMark}
              onRedraw={(mark) => redraw(mark, playback)}
            />
            <p className="hidden px-[var(--space-3)] pb-[var(--space-3)] text-[length:var(--fs-caption)] text-[color:var(--text-muted)] md:block">
              {clipEditorContent.keys}
            </p>
          </>
        )
      }
    >
      {drawing ? (
        <TelestrationToolbar
          state={telestration.state}
          dispatch={telestration.dispatch}
          videoRef={videoRef}
          onClose={telestration.close}
        />
      ) : null}
    </EditedClipStage>
  );
}

/**
 * The drawing layer on the picture frame, over the crop the picture shows at
 * the paused frame, so the coach draws on the zoomed picture viewers will see.
 */
function MarkDrawingLayer({
  telestration,
  videoRef,
  playback,
  plan,
}: {
  telestration: Telestration;
  videoRef: RefObject<HTMLVideoElement | null>;
  playback: EditedPlayback;
  plan: PlaybackPlan;
}) {
  const fileS = usePlayheadS(playback);
  return (
    <TelestrationLayer
      state={telestration.state}
      dispatch={telestration.dispatch}
      videoRef={videoRef}
      view={zoomAt(plan.zoom, fileS)}
    />
  );
}
