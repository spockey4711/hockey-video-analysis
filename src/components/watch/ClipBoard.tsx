"use client";

/**
 * Coach-facing clip board for the watch page (P2-1). Turns a tag into a shared
 * clip: each captured tag gets a "cut this clip" control that enqueues a cut job
 * through `POST /api/clips`, and a status pill (pending/processing/ready/failed)
 * read back from `GET /api/clips?gameId=`. Without this the product is a tagging
 * app - here is where a tag becomes a clip a coach can share.
 *
 * Mounts into the watch player's sidebar, so it runs inside `GameTagsProvider`
 * and reads the live tag store: a moment tagged this session shows up here at
 * once, without a reload. Live data never touches the DB from the client (see the
 * stack notes) - reads and the enqueue both go through the `/api/clips` route.
 * The board polls while any clip is in flight so the worker's progress surfaces.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  canEnqueueClip,
  hasInFlightClips,
  latestClipByTag,
  type ClipView,
} from "./clip-board";
import { watchContent } from "./content";

import { Card } from "@/components/core/Card";
import { PanelHeader } from "@/components/core/PanelHeader";
import { StatusBadge } from "@/components/data";
import { TagChip } from "@/components/data/TagChip";
import { Button } from "@/components/forms/Button";
import { isClipStatus } from "@/features/clips/status";
import { formatGameClock } from "@/features/player";
import { useGameTags } from "@/features/tagging";
import type { EditableTag } from "@/features/tagging/edit/queries";
import type { TagTypeKey } from "@/lib/tag-types";

/** How often to re-read clip status while a cut is still in flight. */
const POLL_INTERVAL_MS = 4000;

export interface ClipBoardProps {
  /** The game whose tags can be cut into clips. */
  readonly gameId: string;
}

/** Narrow an untrusted `/api/clips` row to the fields the board renders. */
function toClipView(raw: unknown): ClipView | null {
  if (typeof raw !== "object" || raw === null) return null;
  const row = raw as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.tagId !== "string" ||
    !isClipStatus(row.status)
  ) {
    return null;
  }
  return { id: row.id, tagId: row.tagId, status: row.status };
}

export function ClipBoard({ gameId }: ClipBoardProps) {
  const { tags } = useGameTags();
  const [clips, setClips] = useState<readonly ClipView[]>([]);

  // Read the game's clips back through the route handler, returning the parsed
  // list (or null on failure) so the caller owns the state write. Failures are
  // left silent: the board still lists tags and lets the coach queue a cut, and
  // the next poll or enqueue refreshes the status.
  const load = useCallback(async (): Promise<ClipView[] | null> => {
    const response = await fetch(`/api/clips?gameId=${gameId}`);
    if (!response.ok) return null;
    const data = (await response.json()) as { clips?: unknown };
    if (!Array.isArray(data.clips)) return null;
    return data.clips
      .map(toClipView)
      .filter((clip): clip is ClipView => clip !== null);
  }, [gameId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const next = await load();
      if (active && next) setClips(next);
    })();
    return () => {
      active = false;
    };
  }, [load]);

  // The API lists clips newest-first; latestClipByTag keeps that order, so a
  // freshly enqueued clip (prepended below) wins over any older attempt.
  const byTag = useMemo(() => latestClipByTag(clips), [clips]);

  // Poll only while a cut is still moving, and stop once every clip is terminal
  // (ready/failed) so an idle board makes no requests.
  useEffect(() => {
    if (!hasInFlightClips(byTag)) return;
    const timer = setInterval(() => {
      void (async () => {
        const next = await load();
        if (next) setClips(next);
      })();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [byTag, load]);

  const handleEnqueued = useCallback((clip: ClipView) => {
    setClips((current) => [clip, ...current]);
  }, []);

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
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {watchContent.clips.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-[var(--space-2)]">
          {tags.map((tag) => (
            <ClipRow
              key={tag.id}
              tag={tag}
              clip={byTag.get(tag.id)}
              onEnqueued={handleEnqueued}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

interface ClipRowProps {
  readonly tag: EditableTag;
  readonly clip: ClipView | undefined;
  readonly onEnqueued: (clip: ClipView) => void;
}

function ClipRow({ tag, clip, onEnqueued }: ClipRowProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enqueue(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/clips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tagId: tag.id }),
      });
      if (!response.ok) {
        throw new Error(`enqueue failed with ${response.status}`);
      }
      const { clip: created } = (await response.json()) as { clip: unknown };
      const view = toClipView(created);
      // A live clip already covers the tag, so the idempotent route may return
      // one that is not the row just posted; either way it is this tag's status.
      if (view) onEnqueued(view);
    } catch {
      setError(watchContent.clips.error);
    } finally {
      setBusy(false);
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
              onClick={() => void enqueue()}
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
