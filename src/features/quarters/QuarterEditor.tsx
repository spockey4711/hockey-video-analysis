"use client";

/**
 * Quarter editor and navigator (P1-4, PRD 5.3). The watch page (P0-5) mounts
 * this into the player's `sidebar` slot: the coach marks each quarter's start
 * (and optional end) from the live game time and jumps back to any quarter's
 * start. Boundaries are saved as a whole set via `PUT /api/quarters` - live data
 * goes through the route handler, never a direct DB call from the client (see
 * the stack notes).
 */
import { useState } from "react";

import { quartersContent } from "./content";
import { initialDraft, toQuarters, type QuarterDraft } from "./draft";
import { quarterAt, type Quarter } from "./navigation";

import { Card } from "@/components/core/Card";
import { PanelHeader } from "@/components/core/PanelHeader";
import { Button } from "@/components/forms/Button";
import { formatGameClock, usePlayerController } from "@/features/player";

export interface QuarterEditorProps {
  gameId: string;
  /** Quarters already persisted for this game (empty when none set yet). */
  initialQuarters: readonly Quarter[];
}

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export function QuarterEditor({ gameId, initialQuarters }: QuarterEditorProps) {
  const controller = usePlayerController();
  const [draft, setDraft] = useState<QuarterDraft[]>(() =>
    initialDraft(initialQuarters),
  );
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const marked = toQuarters(draft);
  const activeIndex = quarterAt(marked, controller.gameTimeS)?.index ?? null;

  function update(index: number, patch: Partial<QuarterDraft>): void {
    setStatus({ kind: "idle" });
    setDraft((rows) =>
      rows.map((row) => (row.index === index ? { ...row, ...patch } : row)),
    );
  }

  async function save(): Promise<void> {
    setStatus({ kind: "saving" });
    try {
      const response = await fetch("/api/quarters", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameId, quarters: toQuarters(draft) }),
      });
      if (!response.ok) throw new Error(`save failed with ${response.status}`);
      setStatus({ kind: "saved" });
    } catch {
      setStatus({ kind: "error", message: quartersContent.errors.save });
    }
  }

  return (
    <Card
      as="section"
      panel
      aria-label={quartersContent.panelTitle}
      className="flex flex-col gap-[var(--space-3)] p-[var(--space-4)]"
    >
      <PanelHeader
        title={quartersContent.panelTitle}
        hint={quartersContent.panelHint}
      />

      <ul className="flex flex-col gap-[var(--space-2)]">
        {draft.map((row) => (
          <li
            key={row.index}
            className="flex items-center gap-[var(--space-2)] text-[length:var(--fs-body-sm)] text-[color:var(--text-primary)]"
          >
            <span
              className={
                row.index === activeIndex
                  ? "w-[9ch] shrink-0 [font-weight:var(--fw-semibold)] text-[color:var(--accent)]"
                  : "w-[9ch] shrink-0"
              }
            >
              {quartersContent.quarterLabel(row.index)}
            </span>
            <span className="w-[7ch] shrink-0 font-[family-name:var(--font-mono)] text-[color:var(--text-secondary)] tabular-nums">
              {row.startS === null
                ? quartersContent.notSet
                : formatGameClock(row.startS)}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                update(row.index, { startS: controller.getGameTimeS() })
              }
            >
              {quartersContent.setStart}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={row.startS === null}
              onClick={() => controller.seekTo(row.startS ?? 0)}
            >
              {quartersContent.jump}
            </Button>
          </li>
        ))}
      </ul>

      <Button
        size="sm"
        disabled={marked.length === 0 || status.kind === "saving"}
        onClick={() => void save()}
      >
        {status.kind === "saving"
          ? quartersContent.saving
          : quartersContent.save}
      </Button>

      <p
        aria-live="polite"
        role="status"
        className={
          status.kind === "error"
            ? "min-h-[var(--space-5)] text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
            : "min-h-[var(--space-5)] text-[length:var(--fs-body-sm)] text-[color:var(--success)]"
        }
      >
        {status.kind === "error"
          ? status.message
          : status.kind === "saved"
            ? quartersContent.saved
            : ""}
      </p>
    </Card>
  );
}
