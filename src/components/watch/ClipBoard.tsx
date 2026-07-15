"use client";

/**
 * Coach-facing clip board for the watch page (P2-1). Turns a tag into a shared
 * clip: each captured tag gets a "cut this clip" control that enqueues a cut job
 * and a status pill (pending/processing/ready/failed). All clip state - the read,
 * the polling and the enqueue - lives in the shared {@link ClipBoardProvider} so
 * this board, the top-bar cut action and the tag detail panel stay in step;
 * this component is just the per-tag list bound to the live tag store.
 */
import { useState } from "react";

import { useClipBoard } from "./ClipBoardProvider";
import { canEnqueueClip } from "./clip-board";
import { watchContent } from "./content";

import { Card } from "@/components/core/Card";
import { EmptyState } from "@/components/core/EmptyState";
import { PanelHeader } from "@/components/core/PanelHeader";
import { StatusBadge } from "@/components/data";
import { TagChip } from "@/components/data/TagChip";
import { Button } from "@/components/forms/Button";
import { formatGameClock } from "@/features/player";
import { useGameTags } from "@/features/tagging";
import type { EditableTag } from "@/features/tagging/edit/queries";
import type { TagTypeKey } from "@/lib/tag-types";

export interface ClipBoardProps {
  /** The game whose tags can be cut into clips. */
  readonly gameId: string;
}

export function ClipBoard(_props: ClipBoardProps) {
  const { tags } = useGameTags();

  return (
    <Card
      as="section"
      panel
      aria-label={watchContent.clips.title}
      className="flex flex-col gap-[var(--space-3)] p-[var(--space-4)]"
    >
      <PanelHeader
        title={watchContent.clips.title}
        hint={watchContent.clips.hint}
      />

      {tags.length === 0 ? (
        <EmptyState
          icon="scissors"
          title={watchContent.clips.empty.title}
          hint={watchContent.clips.empty.hint}
          className="py-[var(--space-6)]"
        />
      ) : (
        <ul className="flex flex-col gap-[var(--space-2)]">
          {tags.map((tag) => (
            <ClipRow key={tag.id} tag={tag} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function ClipRow({ tag }: { readonly tag: EditableTag }) {
  const { byTag, enqueueingTagIds, enqueue } = useClipBoard();
  const [error, setError] = useState<string | null>(null);

  const clip = byTag.get(tag.id);
  const busy = enqueueingTagIds.has(tag.id);

  async function cut(): Promise<void> {
    setError(null);
    try {
      await enqueue(tag.id);
    } catch {
      setError(watchContent.clips.error);
    }
  }

  const canCut = canEnqueueClip(clip);
  const label =
    clip?.status === "failed"
      ? watchContent.clips.retry
      : watchContent.clips.create;

  return (
    <li className="flex flex-col gap-[var(--space-2)] text-[length:var(--fs-body-sm)] text-[color:var(--text-primary)]">
      <div className="flex flex-wrap items-center gap-[var(--space-2)]">
        <TagChip type={tag.type as TagTypeKey} size="sm" />
        <span className="font-[family-name:var(--font-mono)] text-[color:var(--text-secondary)] tabular-nums">
          {formatGameClock(tag.startS)}
        </span>
        <span className="ms-auto flex items-center gap-[var(--space-2)]">
          {clip && <StatusBadge status={clip.status} />}
          {canCut && (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void cut()}
            >
              {busy ? watchContent.clips.enqueuing : label}
            </Button>
          )}
        </span>
      </div>

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
