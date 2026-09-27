"use client";

/**
 * Quarter editor and navigator (P1-4, PRD 5.3). The watch page (P0-5)
 * mounts this into the player's timeline controls: the coach marks each
 * quarter's start and end from the live game time and jumps back to any
 * quarter's start. Marked ends are what lets playback skip the breaks of an
 * uncut recording (see `QuarterBreakSkip`). Boundaries are saved as a whole set
 * via `PUT /api/quarters` - live data goes through the route handler, never a
 * direct DB call from the client (see the stack notes) - and the page is then
 * refreshed so the clock, timeline bands and break skipping pick them up.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

import { quartersContent, type PeriodsContent } from "./content";
import {
  draftProblem,
  initialDraft,
  toQuarters,
  type QuarterDraft,
} from "./draft";
import { quarterAt, type Quarter } from "./navigation";

import { PanelHeader } from "@/components/core/PanelHeader";
import { Button } from "@/components/forms/Button";
import { IconButton } from "@/components/forms/IconButton";
import type { PeriodCount } from "@/features/game-format/format";
import { formatGameClock, usePlayerController } from "@/features/player";

export interface QuarterEditorProps {
  gameId: string;
  /** Quarters already persisted for this game (empty when none set yet). */
  initialQuarters: readonly Quarter[];
  /** How many periods the game plays (its format): one row each. */
  periodCount: PeriodCount;
}

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

const COLUMN_HEADER =
  "text-[length:var(--fs-caption)] text-[color:var(--text-muted)]";
const TIME_BUTTON =
  "w-full justify-center font-[family-name:var(--font-mono)] tabular-nums";

/**
 * The quarter start/end editor. It opens inside the watch timeline's
 * `TimelineDisclosure`, whose overlay `Card` supplies the floating surface, so
 * the editor itself carries no frame of its own.
 */
export function QuarterEditor({
  gameId,
  initialQuarters,
  periodCount,
}: QuarterEditorProps) {
  const controller = usePlayerController();
  const router = useRouter();
  const content = quartersContent(periodCount);
  const [draft, setDraft] = useState<QuarterDraft[]>(() =>
    initialDraft(initialQuarters, periodCount),
  );
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const marked = toQuarters(draft);
  const problem = draftProblem(draft);
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
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: content.errors.save });
    }
  }

  const message =
    problem !== null
      ? { tone: "error", text: content.problems[problem] }
      : status.kind === "error"
        ? { tone: "error", text: status.message }
        : status.kind === "saved"
          ? { tone: "success", text: content.saved }
          : null;

  return (
    <section
      aria-label={content.panelTitle}
      className="flex w-[22rem] max-w-full flex-col gap-[var(--space-3)] p-[var(--space-4)]"
    >
      <PanelHeader title={content.panelTitle} hint={content.panelHint} />

      <div className="grid grid-cols-[auto_1fr_1fr_var(--control-sm)_var(--control-sm)] items-center gap-x-[var(--space-1)] gap-y-[var(--space-2)] text-[length:var(--fs-body-sm)] text-[color:var(--text-primary)]">
        <span aria-hidden />
        <span className={COLUMN_HEADER}>{content.startColumn}</span>
        <span className={COLUMN_HEADER}>{content.endColumn}</span>
        <span aria-hidden />
        <span aria-hidden />

        {draft.map((row) => (
          <QuarterRow
            key={row.index}
            content={content}
            row={row}
            active={row.index === activeIndex}
            onSetStart={() =>
              update(row.index, { startS: controller.getGameTimeS() })
            }
            onSetEnd={() =>
              update(row.index, { endS: controller.getGameTimeS() })
            }
            onClearEnd={() => update(row.index, { endS: null })}
            onJump={() => controller.seekTo(row.startS ?? 0)}
          />
        ))}
      </div>

      <Button
        size="sm"
        disabled={
          marked.length === 0 || problem !== null || status.kind === "saving"
        }
        onClick={() => void save()}
      >
        {status.kind === "saving" ? content.saving : content.save}
      </Button>

      <p
        aria-live="polite"
        role="status"
        className={
          message?.tone === "error"
            ? "min-h-[var(--space-5)] text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
            : "min-h-[var(--space-5)] text-[length:var(--fs-body-sm)] text-[color:var(--success)]"
        }
      >
        {message?.text ?? ""}
      </p>
    </section>
  );
}

interface QuarterRowProps {
  readonly content: PeriodsContent;
  readonly row: QuarterDraft;
  readonly active: boolean;
  readonly onSetStart: () => void;
  readonly onSetEnd: () => void;
  readonly onClearEnd: () => void;
  readonly onJump: () => void;
}

/** One quarter's cells in the editor grid: label, start, end, clear, jump. */
function QuarterRow({
  content,
  row,
  active,
  onSetStart,
  onSetEnd,
  onClearEnd,
  onJump,
}: QuarterRowProps) {
  return (
    <>
      <span
        className={
          active
            ? "[font-weight:var(--fw-semibold)] whitespace-nowrap text-[color:var(--accent)]"
            : "whitespace-nowrap"
        }
      >
        {content.quarterLabel(row.index)}
      </span>
      <Button
        size="sm"
        variant="secondary"
        className={TIME_BUTTON}
        aria-label={content.setStart(row.index)}
        title={content.setStart(row.index)}
        onClick={onSetStart}
      >
        {row.startS === null ? content.unset : formatGameClock(row.startS)}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        className={TIME_BUTTON}
        disabled={row.startS === null}
        aria-label={content.setEnd(row.index)}
        title={content.setEnd(row.index)}
        onClick={onSetEnd}
      >
        {row.endS === null ? content.unset : formatGameClock(row.endS)}
      </Button>
      {row.endS === null ? (
        <span aria-hidden />
      ) : (
        <IconButton
          name="x"
          size="sm"
          label={content.clearEnd(row.index)}
          onClick={onClearEnd}
        />
      )}
      <IconButton
        name="chevron-right"
        size="sm"
        label={content.jump(row.index)}
        disabled={row.startS === null}
        onClick={onJump}
      />
    </>
  );
}
