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

import { quartersContent } from "./content";
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

const COLUMN_HEADER =
  "text-[length:var(--fs-caption)] text-[color:var(--text-muted)]";
const TIME_BUTTON =
  "w-full justify-center font-[family-name:var(--font-mono)] tabular-nums";

/**
 * The quarter start/end editor. It opens inside the watch timeline's
 * `TimelineDisclosure`, whose overlay `Card` supplies the floating surface, so
 * the editor itself carries no frame of its own.
 */
export function QuarterEditor({ gameId, initialQuarters }: QuarterEditorProps) {
  const controller = usePlayerController();
  const router = useRouter();
  const [draft, setDraft] = useState<QuarterDraft[]>(() =>
    initialDraft(initialQuarters),
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
      setStatus({ kind: "error", message: quartersContent.errors.save });
    }
  }

  const message =
    problem !== null
      ? { tone: "error", text: quartersContent.problems[problem] }
      : status.kind === "error"
        ? { tone: "error", text: status.message }
        : status.kind === "saved"
          ? { tone: "success", text: quartersContent.saved }
          : null;

  return (
    <section
      aria-label={quartersContent.panelTitle}
      className="flex w-[22rem] max-w-full flex-col gap-[var(--space-3)] p-[var(--space-4)]"
    >
      <PanelHeader
        title={quartersContent.panelTitle}
        hint={quartersContent.panelHint}
      />

      <div className="grid grid-cols-[auto_1fr_1fr_var(--control-sm)_var(--control-sm)] items-center gap-x-[var(--space-1)] gap-y-[var(--space-2)] text-[length:var(--fs-body-sm)] text-[color:var(--text-primary)]">
        <span aria-hidden />
        <span className={COLUMN_HEADER}>{quartersContent.startColumn}</span>
        <span className={COLUMN_HEADER}>{quartersContent.endColumn}</span>
        <span aria-hidden />
        <span aria-hidden />

        {draft.map((row) => (
          <QuarterRow
            key={row.index}
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
        {status.kind === "saving"
          ? quartersContent.saving
          : quartersContent.save}
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
  readonly row: QuarterDraft;
  readonly active: boolean;
  readonly onSetStart: () => void;
  readonly onSetEnd: () => void;
  readonly onClearEnd: () => void;
  readonly onJump: () => void;
}

/** One quarter's cells in the editor grid: label, start, end, clear, jump. */
function QuarterRow({
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
        {quartersContent.quarterLabel(row.index)}
      </span>
      <Button
        size="sm"
        variant="secondary"
        className={TIME_BUTTON}
        aria-label={quartersContent.setStart(row.index)}
        title={quartersContent.setStart(row.index)}
        onClick={onSetStart}
      >
        {row.startS === null
          ? quartersContent.unset
          : formatGameClock(row.startS)}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        className={TIME_BUTTON}
        disabled={row.startS === null}
        aria-label={quartersContent.setEnd(row.index)}
        title={quartersContent.setEnd(row.index)}
        onClick={onSetEnd}
      >
        {row.endS === null ? quartersContent.unset : formatGameClock(row.endS)}
      </Button>
      {row.endS === null ? (
        <span aria-hidden />
      ) : (
        <IconButton
          name="x"
          size="sm"
          label={quartersContent.clearEnd(row.index)}
          onClick={onClearEnd}
        />
      )}
      <IconButton
        name="chevron-right"
        size="sm"
        label={quartersContent.jump(row.index)}
        disabled={row.startS === null}
        onClick={onJump}
      />
    </>
  );
}
