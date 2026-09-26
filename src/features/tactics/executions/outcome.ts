/**
 * Plan vs reality for the set-play library: the pure rules behind a scene's
 * executions ("Ausführungen"), the tagged moments where the team played it.
 * How an execution went, the count and success rate a scene shows, the
 * outcome a new link starts with, and the order the executions play in.
 * Framework-free, so every rule is unit-tested directly.
 */

/** How an execution went, as the coach rates it; `open` until rated. */
export const EXECUTION_OUTCOMES = ["success", "failure", "open"] as const;

export type ExecutionOutcome = (typeof EXECUTION_OUTCOMES)[number];

/** Read an outcome from a form or request body, or `null` when it is none. */
export function parseExecutionOutcome(value: unknown): ExecutionOutcome | null {
  return typeof value === "string" &&
    (EXECUTION_OUTCOMES as readonly string[]).includes(value)
    ? (value as ExecutionOutcome)
    : null;
}

/** The most tags one pick links, far above a season of corners. */
export const MAX_LINKS_PER_PICK = 500;

/** How many executions a scene has, and how many of each outcome. */
export interface ExecutionStats {
  readonly total: number;
  readonly success: number;
  readonly failure: number;
  readonly open: number;
}

export const NO_EXECUTIONS: ExecutionStats = Object.freeze({
  total: 0,
  success: 0,
  failure: 0,
  open: 0,
});

/** Count a scene's executions by outcome. */
export function executionStats(
  outcomes: Iterable<ExecutionOutcome>,
): ExecutionStats {
  const counts = { success: 0, failure: 0, open: 0 };
  for (const outcome of outcomes) counts[outcome] += 1;
  return {
    total: counts.success + counts.failure + counts.open,
    ...counts,
  };
}

/**
 * The share of rated executions that worked, as a whole percent, or `null`
 * while none is rated. Open executions are left out: an unrated corner is
 * not a failed one.
 */
export function successRate(stats: ExecutionStats): number | null {
  const rated = stats.success + stats.failure;
  return rated === 0 ? null : Math.round((stats.success / rated) * 100);
}

/** A tagged moment's clip window in global game time (ADR 0002). */
export interface ExecutionWindow {
  readonly startS: number;
  readonly endS: number;
}

/**
 * The outcome a new link starts with. The tag types only tell one thing
 * without doubt: a goal ("Tor") tagged inside the execution's window means
 * it worked. Anything else - no goal, or a goal just outside - could be a
 * corner that was saved, won another corner or was not tagged to the end, so
 * it stays `open` for the coach to rate. `goals` are the windows of the game's
 * goal tags; the execution itself counts when it is a goal.
 */
export function defaultOutcome(
  execution: ExecutionWindow,
  goals: readonly ExecutionWindow[],
): ExecutionOutcome {
  return goals.some(
    (goal) => goal.startS < execution.endS && execution.startS < goal.endS,
  )
    ? "success"
    : "open";
}

/** Where an execution sits in the play order. */
export interface ExecutionPlace {
  readonly tagId: string;
  /** The game's date (`YYYY-MM-DD`), or `null` when the game has none. */
  readonly playedOn: string | null;
  readonly gameId: string;
  readonly startS: number;
}

/**
 * The executions' play order, the order the share links play clips in: the
 * newest game first, then by game time within a game. A game without a date
 * comes last, games on the same day stay together, and the tag id breaks the
 * last tie, so the order never depends on how the rows were read.
 */
export function compareExecutions(
  a: ExecutionPlace,
  b: ExecutionPlace,
): number {
  if (a.playedOn !== b.playedOn) {
    if (a.playedOn === null) return 1;
    if (b.playedOn === null) return -1;
    return a.playedOn < b.playedOn ? 1 : -1;
  }
  if (a.gameId !== b.gameId) return a.gameId < b.gameId ? -1 : 1;
  if (a.startS !== b.startS) return a.startS - b.startS;
  return a.tagId < b.tagId ? -1 : a.tagId > b.tagId ? 1 : 0;
}
