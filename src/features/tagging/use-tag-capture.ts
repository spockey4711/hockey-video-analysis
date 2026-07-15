"use client";

/**
 * Hotkey/click tag capture (P0-6), extracted from the old legend panel so the
 * workspace can drive it from the transport bar's tag buttons and the keyboard
 * at once. A capture takes the live global game time plus a tag type and persists
 * the default clip window via `POST /api/tags` (PRD 5.2). The window keydown
 * listener binds once and reads fresh props through a ref (no stale closure);
 * `captureType` fires the same path from a button click. Live data goes through
 * the route handler, never a direct DB call from the client.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { captureTag, formatClock } from "./capture";
import { taggingContent } from "./content";

import { tagTypeForHotkey, type TagTypeDef } from "@/lib/tag-types";

/** The persisted tag echoed back to the caller after a successful capture. */
export interface CapturedTagResult {
  id: string;
  type: string;
  startS: number;
  endS: number | null;
}

export interface UseTagCaptureOptions {
  gameId: string;
  /** Reads the current global game-time offset in seconds (P0-4 coordinate). */
  getCurrentTimeS: () => number;
  /** Total game length; clamps the capture window at the final frame. */
  totalDurationS?: number;
  /** Disable capture (e.g. while a dialog owns the keyboard). Defaults to on. */
  enabled?: boolean;
  onCaptured?: (tag: CapturedTagResult) => void;
  onError?: (message: string) => void;
}

export type CaptureFeedback =
  { kind: "captured"; message: string } | { kind: "error"; message: string };

export interface UseTagCapture {
  /** Capture the given tag type at the live game time (button click). */
  readonly captureType: (type: TagTypeDef) => void;
  /** The last capture's confirmation or error, for an aria-live region. */
  readonly feedback: CaptureFeedback | null;
}

/** Whether a keydown target is a text-entry surface we must not hijack. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function useTagCapture({
  gameId,
  getCurrentTimeS,
  totalDurationS,
  enabled = true,
  onCaptured,
  onError,
}: UseTagCaptureOptions): UseTagCapture {
  const [feedback, setFeedback] = useState<CaptureFeedback | null>(null);

  // Keep the latest props in a ref so the window listener can bind once and
  // still read fresh values, avoiding a stale closure without re-subscribing.
  const latest = useRef({
    gameId,
    getCurrentTimeS,
    totalDurationS,
    enabled,
    onCaptured,
    onError,
  });
  useEffect(() => {
    latest.current = {
      gameId,
      getCurrentTimeS,
      totalDurationS,
      enabled,
      onCaptured,
      onError,
    };
  });

  const capture = useCallback(async (type: TagTypeDef): Promise<void> => {
    const props = latest.current;

    let window_;
    try {
      window_ = captureTag(type, props.getCurrentTimeS(), {
        maxS: props.totalDurationS,
      });
    } catch {
      setFeedback({ kind: "error", message: taggingContent.errors.capture });
      props.onError?.(taggingContent.errors.capture);
      return;
    }

    try {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          gameId: props.gameId,
          type: window_.type,
          startS: window_.startS,
          endS: window_.endS,
        }),
      });
      if (!response.ok) {
        throw new Error(`tag save failed with ${response.status}`);
      }
      const { tag } = (await response.json()) as { tag: CapturedTagResult };
      setFeedback({
        kind: "captured",
        message: taggingContent.captured(
          type.label,
          formatClock(window_.startS),
        ),
      });
      props.onCaptured?.(tag);
    } catch {
      setFeedback({ kind: "error", message: taggingContent.errors.save });
      props.onError?.(taggingContent.errors.save);
    }
  }, []);

  const captureType = useCallback(
    (type: TagTypeDef) => {
      if (!latest.current.enabled) return;
      void capture(type);
    },
    [capture],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (!latest.current.enabled) return;
      if (event.defaultPrevented || event.repeat) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      const type = tagTypeForHotkey(event.key);
      if (!type) return;
      event.preventDefault();
      void capture(type);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [capture]);

  return { captureType, feedback };
}
