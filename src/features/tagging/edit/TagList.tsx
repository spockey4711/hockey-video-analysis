"use client";

/**
 * Coach-facing list of a game's captured tags with per-row edit and delete
 * (P0-8, PRD 5.2). Mounts beside the hotkey capture panel in the watch player's
 * sidebar, so it runs inside the player context and can jump the timeline to a
 * tag or stamp a fresh clip window from the live game time. Edits and deletes go
 * through `PATCH`/`DELETE /api/tags/[id]` - live data never touches the DB from
 * the client (see the stack notes). The parent (`TaggingPanel`) owns the list
 * state so a new hotkey capture and an edit here stay in sync.
 */
import { useState } from "react";

import { tagEditContent } from "./content";
import type { EditableTag } from "./queries";

import { Card } from "@/components/core/Card";
import { PanelHeader } from "@/components/core/PanelHeader";
import { TagChip } from "@/components/data/TagChip";
import { Button } from "@/components/forms/Button";
import { Select } from "@/components/forms/Select";
import { formatGameClock, usePlayerController } from "@/features/player";
import {
  TagPlayersEditor,
  tagPlayersContent,
  type RosterPlayer,
} from "@/features/tag-players";
import { TAG_TYPES, type TagTypeKey } from "@/lib/tag-types";

export interface TagListProps {
  /** The game's tags, ordered by start time; owned by the parent. */
  readonly tags: readonly EditableTag[];
  /** Every selectable player, for the per-tag players/visibility picker (P0-7). */
  readonly roster: readonly RosterPlayer[];
  /** Called with the persisted row after a successful edit. */
  readonly onEdited: (tag: EditableTag) => void;
  /** Called with the tag id after a successful delete. */
  readonly onDeleted: (id: string) => void;
}

/** Options for the type picker, mirroring the configurable tag-type set (P1-3). */
const TYPE_OPTIONS = TAG_TYPES.map((type) => ({
  value: type.key,
  label: type.label,
}));

export function TagList({ tags, roster, onEdited, onDeleted }: TagListProps) {
  return (
    <Card
      as="section"
      panel
      aria-label={tagEditContent.panelTitle}
      className="flex flex-col gap-[var(--space-3)] p-[var(--space-4)]"
    >
      <PanelHeader
        title={tagEditContent.panelTitle}
        hint={tagEditContent.panelHint}
      />

      {tags.length === 0 ? (
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {tagEditContent.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-[var(--space-2)]">
          {tags.map((tag) => (
            <TagRow
              key={tag.id}
              tag={tag}
              roster={roster}
              onEdited={onEdited}
              onDeleted={onDeleted}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

type RowMode =
  | { readonly kind: "view" }
  | {
      readonly kind: "edit";
      readonly type: string;
      readonly startS: number;
      readonly endS: number | null;
    }
  | { readonly kind: "players" }
  | { readonly kind: "confirmDelete" };

interface TagRowProps {
  readonly tag: EditableTag;
  readonly roster: readonly RosterPlayer[];
  readonly onEdited: (tag: EditableTag) => void;
  readonly onDeleted: (id: string) => void;
}

function TagRow({ tag, roster, onEdited, onDeleted }: TagRowProps) {
  const controller = usePlayerController();
  const [mode, setMode] = useState<RowMode>({ kind: "view" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // The row unmounts on success, so there is no state left to reset here.
    } catch {
      setError(tagEditContent.errors.delete);
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-[var(--space-2)] text-[length:var(--fs-body-sm)] text-[color:var(--text-primary)]">
      {mode.kind === "edit" ? (
        <TagEditForm
          draft={mode}
          busy={busy}
          getCurrentTimeS={controller.getGameTimeS}
          onChange={(patch) => setMode({ ...mode, ...patch })}
          onCancel={() => {
            setError(null);
            setMode({ kind: "view" });
          }}
          onSave={() =>
            void save({ type: mode.type, startS: mode.startS, endS: mode.endS })
          }
        />
      ) : mode.kind === "players" ? (
        <TagPlayersEditor
          tagId={tag.id}
          roster={roster}
          initialVisibility={tag.visibility}
          onSaved={(result) => {
            // The picker owns visibility; sync the row so the list stays in step.
            onEdited({ ...tag, visibility: result.visibility });
            setMode({ kind: "view" });
          }}
          onCancel={() => setMode({ kind: "view" })}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-[var(--space-2)]">
          <TagChip type={tag.type as TagTypeKey} size="sm" />
          <span
            aria-label={tagEditContent.windowLabel(
              formatGameClock(tag.startS),
              tag.endS === null
                ? tagEditContent.defaultWindow
                : formatGameClock(tag.endS),
            )}
            className="font-[family-name:var(--font-mono)] text-[color:var(--text-secondary)] tabular-nums"
          >
            {formatGameClock(tag.startS)} -{" "}
            {tag.endS === null
              ? tagEditContent.defaultWindow
              : formatGameClock(tag.endS)}
          </span>
          <span className="ms-auto flex items-center gap-[var(--space-1)]">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => controller.seekTo(tag.startS)}
            >
              {tagEditContent.jump}
            </Button>
            {mode.kind === "confirmDelete" ? null : (
              <>
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
                  onClick={() => setMode({ kind: "players" })}
                >
                  {tagPlayersContent.manage}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setMode({ kind: "confirmDelete" })}
                >
                  {tagEditContent.delete}
                </Button>
              </>
            )}
          </span>
        </div>
      )}

      {mode.kind === "confirmDelete" && (
        <div className="flex flex-wrap items-center gap-[var(--space-2)]">
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
      )}

      <p
        aria-live="polite"
        role="status"
        className="text-[length:var(--fs-body-sm)] text-[color:var(--danger)] empty:hidden"
      >
        {error ?? ""}
      </p>
    </li>
  );
}

interface TagEditFormProps {
  readonly draft: { type: string; startS: number; endS: number | null };
  readonly busy: boolean;
  readonly getCurrentTimeS: () => number;
  readonly onChange: (patch: Partial<TagEditFormProps["draft"]>) => void;
  readonly onCancel: () => void;
  readonly onSave: () => void;
}

/** Inline editor for a tag's type and clip window, driven off the live player. */
function TagEditForm({
  draft,
  busy,
  getCurrentTimeS,
  onChange,
  onCancel,
  onSave,
}: TagEditFormProps) {
  // An explicit end must sit after the start; a null end (default window) is
  // always valid. This guards Save so an invalid window is never submitted.
  const windowValid = draft.endS === null || draft.endS > draft.startS;

  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      <Select
        label={tagEditContent.typeLabel}
        options={TYPE_OPTIONS}
        value={draft.type}
        disabled={busy}
        onChange={(event) => onChange({ type: event.target.value })}
      />

      <div className="flex flex-wrap items-center gap-[var(--space-2)] font-[family-name:var(--font-mono)] text-[color:var(--text-secondary)] tabular-nums">
        <span>{formatGameClock(draft.startS)}</span>
        <span aria-hidden>-</span>
        <span>
          {draft.endS === null
            ? tagEditContent.defaultWindow
            : formatGameClock(draft.endS)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-[var(--space-1)]">
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => onChange({ startS: getCurrentTimeS() })}
        >
          {tagEditContent.setStart}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => onChange({ endS: getCurrentTimeS() })}
        >
          {tagEditContent.setEnd}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy || draft.endS === null}
          onClick={() => onChange({ endS: null })}
        >
          {tagEditContent.clearEnd}
        </Button>
      </div>

      <div className="flex items-center gap-[var(--space-1)]">
        <Button
          size="sm"
          disabled={busy || !windowValid}
          onClick={() => onSave()}
        >
          {busy ? tagEditContent.saving : tagEditContent.save}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
          {tagEditContent.cancel}
        </Button>
      </div>
    </div>
  );
}
