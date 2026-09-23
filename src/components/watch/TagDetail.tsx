"use client";

/**
 * The selected-tag detail panel in the tags rail (P0-7/P0-8, styling per the
 * reference's detail card). Shows a tag's type, clip window, visibility and clip
 * status, and hosts its edit/delete and player-assignment actions. Edits and
 * deletes go through `PATCH`/`DELETE /api/tags/[id]`; the cut/status comes from
 * the shared clip board; player links go through {@link TagPlayersEditor}. Runs
 * inside the player context, so it reads live game time for the window controls.
 */
import { Fragment, useState } from "react";

import { useClipBoard } from "./ClipBoardProvider";
import { canEnqueueClip } from "./clip-board";
import { watchContent } from "./content";

import { Icon } from "@/components/core/Icon";
import { StatusBadge } from "@/components/data";
import { TagChip } from "@/components/data/TagChip";
import { Timecode } from "@/components/data/Timecode";
import { Button } from "@/components/forms/Button";
import { IconButton } from "@/components/forms/IconButton";
import { Select } from "@/components/forms/Select";
import { CommentThread } from "@/features/clips/comments/CommentThread";
import { usePlayerController } from "@/features/player";
import {
  TagPlayersEditor,
  tagPlayersContent,
  type RosterPlayer,
} from "@/features/tag-players";
import { tagEditContent } from "@/features/tagging/edit/content";
import type { EditableTag } from "@/features/tagging/edit/queries";
import { clipWindowChanged } from "@/features/tagging/edit/recut";
import {
  effectiveEnd,
  isValidWindow,
  nudgeEdge,
  TRIM_STEP_S,
  type WindowEdge,
} from "@/features/tagging/edit/trim";
import { TAG_TYPES, type TagTypeKey } from "@/lib/tag-types";

export interface TagDetailProps {
  readonly tag: EditableTag;
  readonly roster: readonly RosterPlayer[];
  readonly onEdited: (tag: EditableTag) => void;
  readonly onDeleted: (id: string) => void;
}

type Mode =
  | { kind: "view" }
  | { kind: "edit"; type: string; startS: number; endS: number | null }
  | { kind: "players" }
  | { kind: "confirmDelete" };

const TYPE_OPTIONS = TAG_TYPES.map((type) => ({
  value: type.key,
  label: type.label,
}));

const VISIBILITY_LABEL: Record<EditableTag["visibility"], string> = {
  team: tagPlayersContent.visibilityTeam,
  single: tagPlayersContent.visibilitySingle,
};

export function TagDetail({
  tag,
  roster,
  onEdited,
  onDeleted,
}: TagDetailProps) {
  const controller = usePlayerController();
  const { byTag, enqueueingTagIds, enqueue, refresh } = useClipBoard();
  const [mode, setMode] = useState<Mode>({ kind: "view" });
  const [busy, setBusy] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clip = byTag.get(tag.id);
  const clipBusy = enqueueingTagIds.has(tag.id);

  async function save(draft: {
    type: string;
    startS: number;
    endS: number | null;
  }): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/tags/${tag.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!response.ok) throw new Error(`edit failed with ${response.status}`);
      const { tag: updated } = (await response.json()) as { tag: EditableTag };
      onEdited(updated);
      setMode({ kind: "view" });
      // A moved window sent the clip back to the cutter; show that status now
      // rather than at the next poll (which only runs while a cut is in flight).
      void refresh();
    } catch {
      setError(tagEditContent.errors.save);
    } finally {
      setBusy(false);
    }
  }

  async function remove(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/tags/${tag.id}`, { method: "DELETE" });
      if (!response.ok)
        throw new Error(`delete failed with ${response.status}`);
      onDeleted(tag.id);
    } catch {
      setError(tagEditContent.errors.delete);
      setBusy(false);
    }
  }

  async function cut(): Promise<void> {
    setError(null);
    try {
      await enqueue(tag.id);
    } catch {
      setError(watchContent.clips.error);
    }
  }

  if (mode.kind === "players") {
    return (
      <TagPlayersEditor
        tagId={tag.id}
        roster={roster}
        initialVisibility={tag.visibility}
        onSaved={(result) => {
          onEdited({ ...tag, visibility: result.visibility });
          setMode({ kind: "view" });
        }}
        onCancel={() => setMode({ kind: "view" })}
      />
    );
  }

  if (mode.kind === "edit") {
    const windowValid = isValidWindow(mode);
    // Nudging an edge parks the player on it, so the coach sees the exact
    // frame the clip will start or end on.
    const nudge = (edge: WindowEdge, deltaS: number) => {
      const next = nudgeEdge(mode, edge, deltaS, controller.durationS);
      setMode({ ...mode, ...next });
      controller.pause();
      controller.seekTo(edge === "start" ? next.startS : effectiveEnd(next));
    };
    const edges = [
      {
        edge: "start",
        label: tagEditContent.startLabel,
        seconds: mode.startS,
        isDefault: false,
        setNow: () => setMode({ ...mode, startS: controller.getGameTimeS() }),
      },
      {
        edge: "end",
        label: tagEditContent.endLabel,
        seconds: effectiveEnd(mode),
        isDefault: mode.endS === null,
        setNow: () => setMode({ ...mode, endS: controller.getGameTimeS() }),
      },
    ] as const;
    return (
      <div className="flex flex-col gap-[var(--space-3)]">
        <Select
          label={tagEditContent.typeLabel}
          options={TYPE_OPTIONS}
          value={mode.type}
          disabled={busy}
          onChange={(event) => setMode({ ...mode, type: event.target.value })}
        />
        <div className="grid grid-cols-[auto_auto_1fr] items-center gap-x-[var(--space-3)] gap-y-[var(--space-2)] text-[length:var(--fs-body-sm)]">
          {edges.map(({ edge, label, seconds, isDefault, setNow }) => (
            <Fragment key={edge}>
              <span className="text-[color:var(--text-muted)]">{label}</span>
              <span
                className={
                  isDefault
                    ? "text-[color:var(--text-muted)]"
                    : "text-[color:var(--text-secondary)]"
                }
                title={isDefault ? tagEditContent.defaultWindow : undefined}
              >
                <Timecode seconds={seconds} size="sm" />
              </span>
              <span className="flex items-center justify-end gap-[var(--space-1)]">
                <IconButton
                  name="chevron-left"
                  size="sm"
                  label={tagEditContent.nudgeEarlierLabel(label)}
                  disabled={busy}
                  onClick={() => nudge(edge, -TRIM_STEP_S)}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  aria-label={tagEditContent.setNowLabel(label)}
                  onClick={setNow}
                >
                  {tagEditContent.setNow}
                </Button>
                <IconButton
                  name="chevron-right"
                  size="sm"
                  label={tagEditContent.nudgeLaterLabel(label)}
                  disabled={busy}
                  onClick={() => nudge(edge, TRIM_STEP_S)}
                />
              </span>
            </Fragment>
          ))}
          <span className="text-[color:var(--text-muted)]">
            {tagEditContent.lengthLabel}
          </span>
          <span className="text-[color:var(--text-secondary)]">
            {windowValid ? (
              <Timecode seconds={effectiveEnd(mode) - mode.startS} size="sm" />
            ) : (
              "-"
            )}
          </span>
          <span className="flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              disabled={busy || mode.endS === null}
              onClick={() => setMode({ ...mode, endS: null })}
            >
              {tagEditContent.clearEnd}
            </Button>
          </span>
        </div>
        {!windowValid && (
          <p className="text-[length:var(--fs-body-sm)] text-[color:var(--danger)]">
            {tagEditContent.invalidWindow}
          </p>
        )}
        {clip && clip.status !== "failed" && clipWindowChanged(tag, mode) && (
          <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
            {tagEditContent.recutHint}
          </p>
        )}
        <div className="flex items-center gap-[var(--space-1)]">
          <Button
            size="sm"
            disabled={busy || !windowValid}
            onClick={() =>
              void save({
                type: mode.type,
                startS: mode.startS,
                endS: mode.endS,
              })
            }
          >
            {busy ? tagEditContent.saving : tagEditContent.save}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setError(null);
              setMode({ kind: "view" });
            }}
          >
            {tagEditContent.cancel}
          </Button>
        </div>
        <ErrorLine message={error} />
      </div>
    );
  }

  // view / confirmDelete
  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      <div className="flex items-center justify-between gap-[var(--space-2)]">
        <TagChip type={tag.type as TagTypeKey} solid />
        <IconButton
          name="trash-2"
          label={tagEditContent.delete}
          onClick={() => setMode({ kind: "confirmDelete" })}
        />
      </div>

      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-[var(--space-3)] gap-y-[var(--space-1)] text-[length:var(--fs-body-sm)]">
        <dt className="text-[color:var(--text-muted)]">
          {watchContent.tags.start}
        </dt>
        <dd>
          <Timecode seconds={tag.startS} size="sm" />
        </dd>
        <dt className="text-[color:var(--text-muted)]">
          {watchContent.tags.end}
        </dt>
        <dd>
          {tag.endS === null ? (
            <span className="text-[color:var(--text-secondary)]">
              {watchContent.tags.defaultWindow}
            </span>
          ) : (
            <Timecode seconds={tag.endS} size="sm" />
          )}
        </dd>
        <dt className="text-[color:var(--text-muted)]">
          {watchContent.tags.visibility}
        </dt>
        <dd className="text-[color:var(--text-secondary)]">
          {VISIBILITY_LABEL[tag.visibility]}
        </dd>
      </dl>

      <div className="flex items-center gap-[var(--space-2)]">
        {clip && <StatusBadge status={clip.status} />}
        {canEnqueueClip(clip) && (
          <Button
            size="sm"
            variant="secondary"
            iconLeft="scissors"
            disabled={clipBusy}
            onClick={() => void cut()}
          >
            {clipBusy
              ? watchContent.clips.enqueuing
              : clip?.status === "failed"
                ? watchContent.clips.retry
                : watchContent.clips.create}
          </Button>
        )}
      </div>

      {clip && (
        // The thread mounts only while open, so selecting a tag never fetches
        // comments the coach did not ask for; the rail's footer is not
        // scrollable, so the open panel caps its own height instead.
        <details
          className="group rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[var(--surface-raised)]"
          onToggle={(event) => setCommentsOpen(event.currentTarget.open)}
        >
          <summary className="flex cursor-pointer list-none items-center gap-[var(--space-2)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)] transition duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:text-[color:var(--text-primary)] focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none">
            <Icon name="message-square" size={14} />
            {watchContent.clips.comments}
            <Icon
              name="chevron-down"
              size={14}
              className="ms-auto transition duration-[var(--dur-fast)] ease-[var(--ease-out)] group-open:rotate-180"
            />
          </summary>
          {commentsOpen && (
            <div className="max-h-[40vh] overflow-y-auto border-t border-[color:var(--border)] px-[var(--space-3)] py-[var(--space-3)]">
              <CommentThread clipId={clip.id} showHeading={false} />
            </div>
          )}
        </details>
      )}

      {mode.kind === "confirmDelete" ? (
        <div className="flex items-center gap-[var(--space-2)] text-[length:var(--fs-body-sm)]">
          <span className="text-[color:var(--text-secondary)]">
            {tagEditContent.confirmDelete}
          </span>
          <span className="ms-auto flex items-center gap-[var(--space-1)]">
            <Button
              size="sm"
              variant="danger"
              disabled={busy}
              onClick={() => void remove()}
            >
              {tagEditContent.confirmYes}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setError(null);
                setMode({ kind: "view" });
              }}
            >
              {tagEditContent.cancel}
            </Button>
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-[var(--space-1)]">
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              setMode({
                kind: "edit",
                type: tag.type,
                startS: tag.startS,
                endS: tag.endS,
              })
            }
          >
            {tagEditContent.edit}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            iconLeft="users"
            onClick={() => setMode({ kind: "players" })}
          >
            {tagPlayersContent.manage}
          </Button>
        </div>
      )}

      <ErrorLine message={error} />
    </div>
  );
}

function ErrorLine({ message }: { message: string | null }) {
  return (
    <p
      aria-live="polite"
      role="status"
      className="text-[length:var(--fs-body-sm)] text-[color:var(--danger)] empty:hidden"
    >
      {message ?? ""}
    </p>
  );
}
