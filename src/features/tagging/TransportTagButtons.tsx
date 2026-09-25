"use client";

/**
 * The transport bar's tag-capture buttons (P0-6). Each button is one tag type,
 * showing its hotkey cap and coded chip; clicking captures the current game time,
 * and the same {@link useTagCapture} hook keeps the keyboard shortcuts live. A
 * fresh capture defaults to team visibility and is pushed into the shared tag
 * store, so it appears in the tags rail at once. Mounted into the player's
 * transport slot, inside the player and tag-store contexts.
 *
 * In fullscreen (P2-16) the player moves this same element onto the video stage,
 * where the tags rail is off screen. The buttons then wear the broadcast surface
 * and the capture confirmation becomes visible rather than screen-reader-only,
 * because it is the coach's only signal that a hotkey landed.
 */
import { useCallback } from "react";

import { useGameTags } from "./GameTagsProvider";
import { taggingContent } from "./content";
import { useTagCapture, type CapturedTagResult } from "./use-tag-capture";

import { cn } from "@/components/core/cn";
import { Kbd } from "@/components/data/Kbd";
import { TagChip } from "@/components/data/TagChip";
import { usePlayerController, useFullscreenState } from "@/features/player";
import { TAG_TYPES } from "@/lib/tag-types";

export interface TransportTagButtonsProps {
  /** The game whose moments are being tagged. */
  readonly gameId: string;
}

export function TransportTagButtons({ gameId }: TransportTagButtonsProps) {
  const { getGameTimeS, durationS } = usePlayerController();
  const { isActive: onStage } = useFullscreenState();
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
    <div
      className={cn(
        "flex gap-[var(--space-2)]",
        onStage ? "flex-col items-center" : "flex-wrap items-center",
      )}
    >
      {/* On the stage the last capture reads back above the keys; in the
          workspace the tag landing in the rail is the visible confirmation. */}
      {onStage ? (
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "rounded-[var(--radius-pill)] bg-[var(--video-scrim)] px-[var(--space-3)] py-[var(--space-1)] text-[length:var(--fs-caption)]",
            feedback?.kind === "error"
              ? "text-[color:var(--danger)]"
              : "text-[color:var(--video-ink)]",
          )}
        >
          {feedback ? feedback.message : taggingContent.legendHint}
        </p>
      ) : null}

      <ul
        aria-label={taggingContent.legendTitle}
        className={cn(
          "flex flex-wrap items-center gap-[var(--space-1)]",
          onStage ? "justify-center" : "justify-end",
        )}
      >
        {TAG_TYPES.map((type) => (
          <li key={type.key}>
            <button
              type="button"
              onClick={() => captureType(type)}
              title={`${type.label} (${type.hotkey.toUpperCase()})`}
              className={cn(
                "inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius-md)] border px-[var(--space-2)] py-[var(--space-1)] transition duration-[var(--dur-fast)] ease-[var(--ease-out)] focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none",
                onStage
                  ? "border-transparent bg-[var(--video-scrim)] hover:brightness-125"
                  : "border-[color:var(--border)] bg-[var(--surface-raised)] hover:bg-[var(--surface-hover)]",
              )}
            >
              <Kbd size="sm">{type.hotkey.toUpperCase()}</Kbd>
              <TagChip type={type.key} size="sm" />
            </button>
          </li>
        ))}
      </ul>

      {/* Exactly one live region per mode: on the stage the readout above is it,
          here it is this screen-reader confirmation, because the visible
          confirmation is the tag landing in the rail. Errors surface visibly in
          the workspace too, since nothing else signals them there. */}
      {!onStage ? (
        <span aria-live="polite" role="status" className="sr-only">
          {feedback?.kind === "captured" ? feedback.message : ""}
        </span>
      ) : null}
      {!onStage && feedback?.kind === "error" ? (
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
