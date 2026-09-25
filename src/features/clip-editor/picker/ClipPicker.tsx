"use client";

import { useEffect, useState } from "react";

import { addClip, loadPicker } from "./client";
import { pickerContent } from "./content";
import {
  filterPickerClips,
  NO_FILTER,
  type PickerClip,
  type PickerData,
  type PickerFilter,
  type PickerOption,
} from "./picker";

import { EmptyState } from "@/components/core/EmptyState";
import { Icon } from "@/components/core/Icon";
import { Button } from "@/components/forms/Button";
import { Select } from "@/components/forms/Select";

export interface ClipPickerProps {
  readonly collectionId: string;
  /** Called with a clip once it is in the collection. */
  readonly onAdded: (clipId: string) => void;
}

type Load = "loading" | "failed" | PickerData;

const { picker: copy } = pickerContent;

function withAll(options: readonly PickerOption[]) {
  return [{ value: "", label: copy.all }, ...options];
}

/**
 * The clip editor's "Clips hinzufügen" (ADR 0011): every ready clip, narrowed
 * by game, tag type and player, each added to the collection with one click.
 * A clip already in the collection is marked instead of offered again, since
 * one clip is at most one entry of a collection. It stays open, so a coach can
 * add several clips in a row.
 */
export function ClipPicker({ collectionId, onAdded }: ClipPickerProps) {
  const [load, setLoad] = useState<Load>("loading");
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<PickerFilter>(NO_FILTER);
  // Clips added (or found already added) since the picker opened.
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const [adding, setAdding] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    void loadPicker(collectionId).then((data) => {
      if (live) setLoad(data ?? "failed");
    });
    return () => {
      live = false;
    };
  }, [collectionId, attempt]);

  async function add(clip: PickerClip) {
    setAdding(clip.id);
    setFailed(false);
    const outcome = await addClip(collectionId, clip.id);
    setAdding(null);
    if (outcome === "failed") {
      setFailed(true);
      return;
    }
    setAdded((current) => new Set(current).add(clip.id));
    if (outcome === "added") onAdded(clip.id);
  }

  if (load === "loading") {
    return (
      <p
        role="status"
        className="p-[var(--space-6)] text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]"
      >
        {copy.loading}
      </p>
    );
  }
  if (load === "failed") {
    return (
      <div className="flex flex-col items-start gap-[var(--space-3)] p-[var(--space-6)]">
        <p
          role="alert"
          className="text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
        >
          {copy.loadFailed}
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setLoad("loading");
            setAttempt((count) => count + 1);
          }}
        >
          {copy.retry}
        </Button>
      </div>
    );
  }
  if (load.clips.length === 0) {
    return (
      <EmptyState
        icon="film"
        title={copy.none}
        className="p-[var(--space-8)]"
      />
    );
  }

  const shown = filterPickerClips(load.clips, filter);
  const filters = [
    { key: "gameId", label: copy.game, options: load.games },
    { key: "tagType", label: copy.tagType, options: load.tagTypes },
    { key: "playerId", label: copy.player, options: load.players },
  ] as const;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="grid gap-[var(--space-3)] border-b border-[color:var(--border)] px-[var(--space-4)] py-[var(--space-3)] sm:grid-cols-3">
        {filters.map(({ key, label, options }) => (
          <Select
            key={key}
            label={label}
            options={withAll(options)}
            value={filter[key]}
            onChange={(event) =>
              setFilter({ ...filter, [key]: event.target.value })
            }
          />
        ))}
      </div>
      <p
        role="status"
        className="px-[var(--space-4)] pt-[var(--space-3)] text-[length:var(--fs-caption)] text-[color:var(--text-muted)]"
      >
        {shown.length === 0 ? copy.noMatch : copy.count(shown.length)}
      </p>
      {failed ? (
        <p
          role="alert"
          className="px-[var(--space-4)] pt-[var(--space-2)] text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
        >
          {copy.addFailed}
        </p>
      ) : null}
      <ul className="flex min-h-0 flex-col gap-[var(--space-1)] overflow-y-auto p-[var(--space-2)]">
        {shown.map((clip) => (
          <li
            key={clip.id}
            className="flex items-center gap-[var(--space-3)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] hover:bg-[var(--surface-hover)]"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex flex-wrap items-center gap-x-[var(--space-2)] text-[length:var(--fs-body-sm)] [font-weight:var(--fw-medium)]">
                {clip.title}
                {clip.isSingle ? (
                  <span className="rounded-[var(--radius-pill)] border border-[color:var(--border-subtle)] px-[var(--space-2)] text-[length:var(--fs-caption)] [font-weight:var(--fw-regular)] text-[color:var(--text-muted)]">
                    {copy.single}
                  </span>
                ) : null}
              </span>
              <span className="truncate text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
                {clip.subtitle}
              </span>
            </span>
            {clip.inCollection || added.has(clip.id) ? (
              <span className="flex shrink-0 items-center gap-[var(--space-1)] text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
                <Icon name="check" size={14} />
                {copy.added}
              </span>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                iconLeft="plus"
                className="shrink-0"
                disabled={adding !== null}
                aria-label={copy.addLabel(clip.title, clip.subtitle)}
                onClick={() => void add(clip)}
              >
                {copy.add}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
