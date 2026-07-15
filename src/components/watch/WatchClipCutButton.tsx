"use client";

import { useState } from "react";

import { useClipBoard } from "./ClipBoardProvider";
import { canEnqueueClip } from "./clip-board";
import { watchContent } from "./content";

import { Button } from "@/components/forms/Button";
import { useGameTags } from "@/features/tagging";

/**
 * The top bar's primary action: cut a clip from every tag that does not already
 * have a live one. The eligible count comes from the shared clip board, so the
 * "N Clips schneiden" label tracks the tags rail exactly, and a single click
 * enqueues each pending tag through the same provider (no duplicate state).
 */
export function WatchClipCutButton() {
  const { tags } = useGameTags();
  const { byTag, enqueue } = useClipBoard();
  const [busy, setBusy] = useState(false);

  const eligible = tags.filter((tag) => canEnqueueClip(byTag.get(tag.id)));
  const count = eligible.length;

  async function cutAll(): Promise<void> {
    if (count === 0) return;
    setBusy(true);
    try {
      // Enqueue independently so one failure does not abort the rest; the shared
      // board reflects each success and the per-tag status shows any failure.
      await Promise.allSettled(eligible.map((tag) => enqueue(tag.id)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      iconLeft="scissors"
      disabled={busy || count === 0}
      onClick={() => void cutAll()}
    >
      {busy
        ? watchContent.topbar.cutting
        : count > 0
          ? `${count} ${watchContent.topbar.cut}`
          : watchContent.topbar.cut}
    </Button>
  );
}
