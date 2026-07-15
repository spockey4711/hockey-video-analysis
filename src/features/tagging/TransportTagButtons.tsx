"use client";

/**
 * The transport bar's tag-capture buttons (P0-6). Each button is one tag type,
 * showing its hotkey cap and coded chip; clicking captures the current game time,
 * and the same {@link useTagCapture} hook keeps the keyboard shortcuts live. A
 * fresh capture defaults to team visibility and is pushed into the shared tag
 * store, so it appears in the tags rail at once. Mounted into the player's
 * transport slot, inside the player and tag-store contexts.
 */
import { useCallback } from "react";

import { useGameTags } from "./GameTagsProvider";
import { taggingContent } from "./content";
import { useTagCapture, type CapturedTagResult } from "./use-tag-capture";

import { Kbd } from "@/components/data/Kbd";
import { TagChip } from "@/components/data/TagChip";
import { usePlayerController } from "@/features/player";
import { TAG_TYPES } from "@/lib/tag-types";

export interface TransportTagButtonsProps {
  /** The game whose moments are being tagged. */
  readonly gameId: string;
}

export function TransportTagButtons({ gameId }: TransportTagButtonsProps) {
  const { getGameTimeS, durationS } = usePlayerController();
  const { addTag } = useGameTags();

  const onCaptured = useCallback(
    (captured: CapturedTagResult) =>
      addTag({ ...captured, visibility: "team" }),
    [addTag],
  );

  const { captureType, feedback } = useTagCapture({
    gameId,
    getCurrentTimeS: getGameTimeS,
    totalDurationS: durationS,
    onCaptured,
  });

  return (
    <div className="flex items-center gap-[var(--space-2)]">
      <ul
        aria-label={taggingContent.legendTitle}
        className="flex items-center gap-[var(--space-1)]"
      >
        {TAG_TYPES.map((type) => (
          <li key={type.key}>
            <button
              type="button"
              onClick={() => captureType(type)}
              title={`${type.label} (${type.hotkey.toUpperCase()})`}
              className="inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[var(--surface-raised)] px-[var(--space-2)] py-[var(--space-1)] transition duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-[var(--surface-hover)] focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none"
            >
              <Kbd size="sm">{type.hotkey.toUpperCase()}</Kbd>
              <TagChip type={type.key} size="sm" />
            </button>
          </li>
        ))}
      </ul>

      {/* Screen-reader confirmation; the visible confirmation is the tag landing
          in the rail. Errors surface visibly since nothing else signals them. */}
      <span aria-live="polite" role="status" className="sr-only">
        {feedback?.kind === "captured" ? feedback.message : ""}
      </span>
      {feedback?.kind === "error" ? (
        <span
          role="alert"
          className="text-[length:var(--fs-caption)] text-[color:var(--danger)]"
        >
          {feedback.message}
        </span>
      ) : null}
    </div>
  );
}
