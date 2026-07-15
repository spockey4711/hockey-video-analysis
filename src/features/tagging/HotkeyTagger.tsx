"use client";

/**
 * Hotkey tagging capture leaf (P0-6). A single keypress captures the current
 * global game time plus a tag type and persists it via `POST /api/tags` (PRD
 * 5.2). This is the interactive child the watch page (P0-5) mounts into its
 * tagging slot: it reads the live game-time through the `getCurrentTimeS`
 * callback, so it stays decoupled from how the player tracks time.
 *
 * Live data goes through the route handler, never a direct DB call from the
 * client (see the stack notes). The visible surface is a hotkey legend plus an
 * aria-live region that announces each capture for keyboard-first coaches.
 */
import { useEffect, useRef, useState } from "react";

import { captureTag, formatClock } from "./capture";
import { taggingContent } from "./content";

import { Card } from "@/components/core/Card";
import { TAG_TYPES, tagTypeForHotkey } from "@/lib/tag-types";

/** The persisted tag echoed back to the caller after a successful capture. */
export interface CapturedTagResult {
  id: string;
  type: string;
  startS: number;
  endS: number | null;
}

export interface HotkeyTaggerProps {
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

type Feedback =
  { kind: "captured"; message: string } | { kind: "error"; message: string };

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

export function HotkeyTagger({
  gameId,
  getCurrentTimeS,
  totalDurationS,
  enabled = true,
  onCaptured,
  onError,
}: HotkeyTaggerProps) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);

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
  // Sync the ref after each render (never during it, per the rules-of-refs), so
  // the once-bound keydown listener always reads the latest props.
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

  useEffect(() => {
    async function capture(hotkey: string): Promise<void> {
      const props = latest.current;
      const type = tagTypeForHotkey(hotkey);
      if (!type) return;

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
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (!latest.current.enabled) return;
      if (event.defaultPrevented || event.repeat) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      if (!tagTypeForHotkey(event.key)) return;
      event.preventDefault();
      void capture(event.key);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Card
      as="section"
      panel
      aria-label={taggingContent.legendTitle}
      className="flex flex-col gap-[var(--space-3)] p-[var(--space-4)]"
    >
      <div className="flex flex-col gap-[var(--space-1)]">
        <h2 className="text-[length:var(--fs-caption)] [font-weight:var(--fw-semibold)] tracking-[var(--ls-caps)] text-[color:var(--text-secondary)] uppercase">
          {taggingContent.legendTitle}
        </h2>
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {taggingContent.legendHint}
        </p>
      </div>
      <ul className="flex flex-col gap-[var(--space-2)]">
        {TAG_TYPES.map((type) => (
          <li
            key={type.key}
            className="flex items-center gap-[var(--space-3)] text-[length:var(--fs-body-sm)] text-[color:var(--text-primary)]"
          >
            <kbd className="inline-flex h-[var(--control-sm)] min-w-[var(--control-sm)] items-center justify-center rounded-[var(--radius-sm)] border border-[color:var(--border-strong)] bg-[var(--surface-inset)] px-[var(--space-2)] font-[family-name:var(--font-mono)] text-[length:var(--fs-caption)] uppercase">
              {type.hotkey}
            </kbd>
            <span>{type.label}</span>
          </li>
        ))}
      </ul>
      <p
        aria-live="polite"
        role="status"
        className={
          feedback?.kind === "error"
            ? "min-h-[var(--space-5)] text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
            : "min-h-[var(--space-5)] text-[length:var(--fs-body-sm)] text-[color:var(--success)]"
        }
      >
        {feedback?.message ?? ""}
      </p>
    </Card>
  );
}
