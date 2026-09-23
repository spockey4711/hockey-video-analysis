/**
 * Pure draft-state helpers for the quarter editor (P1-4). The editor works over
 * a fixed set of `MAX_QUARTERS` rows - a coach marks each quarter's start (and
 * optional end) as the game plays - and persists the marked rows as a set.
 * Keeping the shaping logic here (no React) makes it unit-testable and keeps the
 * component thin.
 */
import type { Quarter } from "./navigation";
import { MAX_QUARTERS } from "./validation";

/** A single editable quarter row; a `null` `startS` means "not marked yet". */
export interface QuarterDraft {
  readonly index: number;
  readonly startS: number | null;
  readonly endS: number | null;
}

/** The full `1..MAX_QUARTERS` row set, seeded from any persisted quarters. */
export function initialDraft(quarters: readonly Quarter[]): QuarterDraft[] {
  const byIndex = new Map(quarters.map((quarter) => [quarter.index, quarter]));
  return Array.from({ length: MAX_QUARTERS }, (_, i) => {
    const index = i + 1;
    const existing = byIndex.get(index);
    return {
      index,
      startS: existing?.startS ?? null,
      endS: existing?.endS ?? null,
    };
  });
}

/**
 * Collect the marked rows (those with a start) into an index-ordered quarter set
 * ready to send to `PUT /api/quarters`. Rows without a start are dropped, so an
 * unmarked trailing quarter is simply omitted.
 */
export function toQuarters(draft: readonly QuarterDraft[]): Quarter[] {
  return draft
    .filter(
      (row): row is QuarterDraft & { startS: number } => row.startS !== null,
    )
    .sort((a, b) => a.index - b.index)
    .map((row) => ({ index: row.index, startS: row.startS, endS: row.endS }));
}

/**
 * Why a draft cannot be saved, mirroring the cross-quarter rules that
 * `PUT /api/quarters` enforces (see `validation.ts`) so the editor can explain
 * the problem before the server rejects it:
 * - `gap`: a quarter is marked while an earlier one is not.
 * - `endBeforeStart`: a quarter ends at or before its own start.
 * - `order`: a quarter starts at or before the previous quarter's start.
 * - `overlap`: a quarter starts before the previous quarter's marked end.
 */
export type QuarterDraftProblem =
  "gap" | "endBeforeStart" | "order" | "overlap";

/** The first problem that blocks saving the draft, or `null` when it is valid. */
export function draftProblem(
  draft: readonly QuarterDraft[],
): QuarterDraftProblem | null {
  const rows = [...draft].sort((a, b) => a.index - b.index);
  const lastMarked = rows.findLastIndex((row) => row.startS !== null);
  if (
    rows.slice(0, Math.max(lastMarked, 0)).some((row) => row.startS === null)
  ) {
    return "gap";
  }

  const quarters = toQuarters(rows);
  for (let i = 0; i < quarters.length; i += 1) {
    const current = quarters[i];
    if (current.endS !== null && current.endS <= current.startS) {
      return "endBeforeStart";
    }
    const prev = quarters[i - 1];
    if (!prev) continue;
    if (current.startS <= prev.startS) return "order";
    if (prev.endS !== null && prev.endS > current.startS) return "overlap";
  }
  return null;
}
