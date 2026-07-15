"use client";

/**
 * The right tags rail of the workspace: a header count, the scrollable list of a
 * game's captured tags, and the selected-tag detail panel pinned at the bottom
 * (reference layout). Selecting a row seeks the player to that moment and opens
 * its detail. Bound to the shared tag store, so a fresh capture from the
 * transport appears here at once; the detail hosts edit/delete, player
 * assignment and clip cutting. Replaces the old stacked sidebar panels.
 */
import { useState } from "react";

import { TagDetail } from "./TagDetail";
import { watchContent } from "./content";

import { EmptyState } from "@/components/core/EmptyState";
import { cn } from "@/components/core/cn";
import { TagChip } from "@/components/data/TagChip";
import { Timecode } from "@/components/data/Timecode";
import { formatGameClock, usePlayerController } from "@/features/player";
import type { RosterPlayer } from "@/features/tag-players";
import { useGameTags } from "@/features/tagging";
import type { EditableTag } from "@/features/tagging/edit/queries";
import { getTagType, type TagTypeKey } from "@/lib/tag-types";

export interface WatchTagsRailProps {
  /** Every selectable player, for the detail panel's player picker (P0-7). */
  readonly roster: readonly RosterPlayer[];
}

export function WatchTagsRail({ roster }: WatchTagsRailProps) {
  const controller = usePlayerController();
  const { tags, replaceTag, removeTag } = useGameTags();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = tags.find((tag) => tag.id === selectedId) ?? null;

  function select(tag: EditableTag): void {
    setSelectedId(tag.id);
    controller.seekTo(tag.startS);
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]">
      <header className="flex items-center justify-between border-b border-[color:var(--border)] px-[var(--space-4)] py-[var(--space-3)]">
        <h2 className="font-[family-name:var(--font-display)] text-[length:var(--fs-caption)] tracking-[var(--ls-caps)] text-[color:var(--text-secondary)] uppercase">
          {watchContent.tags.heading(tags.length)}
        </h2>
      </header>

      <div className="min-h-0 overflow-y-auto">
        {tags.length === 0 ? (
          <EmptyState
            icon="tag"
            title={watchContent.tags.empty.title}
            hint={watchContent.tags.empty.hint}
            className="p-[var(--space-6)]"
          />
        ) : (
          <ul>
            {tags.map((tag) => {
              const active = tag.id === selectedId;
              const label = getTagType(tag.type)?.label ?? tag.type;
              return (
                <li key={tag.id}>
                  <button
                    type="button"
                    aria-current={active ? "true" : undefined}
                    aria-label={watchContent.tags.select(
                      label,
                      formatGameClock(tag.startS),
                    )}
                    onClick={() => select(tag)}
                    className={cn(
                      "flex w-full items-center gap-[var(--space-3)] border-b border-[color:var(--border-subtle)] px-[var(--space-4)] py-[var(--space-2)] text-left transition duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-[var(--surface-hover)] focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none",
                      active && "bg-[var(--surface-hover)]",
                    )}
                  >
                    <Timecode
                      seconds={tag.startS}
                      size="sm"
                      muted={!active}
                      className="w-[7ch] shrink-0"
                    />
                    <TagChip type={tag.type as TagTypeKey} size="sm" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-[color:var(--border)] px-[var(--space-4)] py-[var(--space-3)]">
        {selected ? (
          <TagDetail
            tag={selected}
            roster={roster}
            onEdited={replaceTag}
            onDeleted={(id) => {
              removeTag(id);
              setSelectedId(null);
            }}
          />
        ) : (
          <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
            {watchContent.tags.selectHint}
          </p>
        )}
      </div>
    </div>
  );
}
