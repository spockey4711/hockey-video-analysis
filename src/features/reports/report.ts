/**
 * Pure aggregation for the per-game overview report (P2-12). Turns a game's
 * existing tags - no new capture - into the key figures a coach reads after the
 * match: how many goals, short corners and good/bad actions, split by quarter
 * and by the players linked to each tag.
 *
 * A tag is one moment that may carry several types (ADR 0016): a short corner
 * that ended in a goal counts under "Ecke kurz" and under "Tor", but only once
 * in every total, so a row's type counts may sum to more than its total.
 *
 * Framework- and DB-free, so the page and the CSV export share one tested
 * definition of every figure. Tag times are global game-time offsets (ADR 0002);
 * the quarter bucketing reuses the quarter lane's `quarterAt`, so a tag exactly
 * on a boundary lands in the same quarter the timeline shows.
 */
import { quarterAt, type Quarter } from "@/features/quarters/navigation";
import {
  isTagTypeKey,
  TAG_TYPES,
  tagTypeKeys,
  type TagTypeKey,
  type TagTypes,
} from "@/lib/tag-types";

/**
 * A tag as the report reads it: its types, start and the players it links. A
 * type key no longer in the tag-type config is skipped; a tag with no
 * configured type left is not counted at all.
 */
export interface ReportTag extends TagTypes {
  readonly id: string;
  /** Global game-time offset of the tag's start, in seconds. */
  readonly startS: number;
  readonly playerIds: readonly string[];
}

/** A player that can appear in the per-player breakdown. */
export interface ReportPlayer {
  readonly id: string;
  readonly name: string;
  readonly jerseyNumber: number | null;
}

/** Tag count per configured tag type. */
export type TypeCounts = Readonly<Record<TagTypeKey, number>>;

/**
 * One row of figures: the per-type counts and the number of tags. A tag with
 * several types counts under each of them but once in the total.
 */
export interface FigureRow {
  readonly counts: TypeCounts;
  readonly total: number;
}

/** The figures of one marked quarter. */
export interface QuarterFigures {
  readonly index: number;
  readonly figures: FigureRow;
}

/** The figures of one player, counting every tag they are linked to. */
export interface PlayerFigures {
  readonly player: ReportPlayer;
  readonly figures: FigureRow;
}

/** The whole per-game report. */
export interface GameReport {
  readonly totals: FigureRow;
  /**
   * Per-quarter figures in quarter order, plus the tags that fall outside every
   * marked quarter (before the first, in a break). `null` when the game has no
   * quarters marked, since a split would then say nothing.
   */
  readonly quarters: {
    readonly rows: readonly QuarterFigures[];
    readonly outside: FigureRow;
  } | null;
  /**
   * Players linked to at least one tag, in roster order (numbered players by
   * jersey number, then by name). A tag linking several players counts for each
   * of them, so these rows may sum to more than {@link GameReport.totals}.
   */
  readonly players: readonly PlayerFigures[];
  /** Tags linked to no (known) player. */
  readonly unassigned: FigureRow;
}

export interface GameReportInput {
  readonly tags: readonly ReportTag[];
  readonly players: readonly ReportPlayer[];
  readonly quarters: readonly Quarter[];
}

/** Narrow a stored type key to a configured key. */
function isKnownType(type: string): type is TagTypeKey {
  return isTagTypeKey(type);
}

/** A mutable tally that freezes into a {@link FigureRow}. */
class Tally {
  // `fromEntries` loses the key type; the entries cover exactly TAG_TYPES.
  private readonly counts = Object.fromEntries(
    TAG_TYPES.map((def) => [def.key, 0]),
  ) as Record<TagTypeKey, number>;

  private total = 0;

  /** Count one tag under each of its (configured, non-empty) types. */
  add(types: readonly TagTypeKey[]): void {
    for (const type of types) this.counts[type] += 1;
    this.total += 1;
  }

  toRow(): FigureRow {
    return { counts: { ...this.counts }, total: this.total };
  }
}

/** A figure row with every count at zero. */
export function emptyFigures(): FigureRow {
  return new Tally().toRow();
}

/** Add two figure rows count by count, e.g. to sum games into a season. */
export function sumFigures(a: FigureRow, b: FigureRow): FigureRow {
  const counts = Object.fromEntries(
    TAG_TYPES.map((def) => [def.key, a.counts[def.key] + b.counts[def.key]]),
  ) as Record<TagTypeKey, number>;
  return { counts, total: a.total + b.total };
}

/**
 * Whether the row holds a tag with several types, so its type counts sum to
 * more than its total; the page then says why.
 */
export function hasMultiTypeTags(figures: FigureRow): boolean {
  const typeHits = TAG_TYPES.reduce(
    (sum, def) => sum + figures.counts[def.key],
    0,
  );
  return typeHits > figures.total;
}

/** Roster order: numbered players ascending, then unnumbered, each by name. */
export function compareRosterOrder(a: ReportPlayer, b: ReportPlayer): number {
  if (a.jerseyNumber !== b.jerseyNumber) {
    if (a.jerseyNumber === null) return 1;
    if (b.jerseyNumber === null) return -1;
    return a.jerseyNumber - b.jerseyNumber;
  }
  return a.name.localeCompare(b.name, "de");
}

/** Aggregate a game's tags into its overview report. */
export function buildGameReport(input: GameReportInput): GameReport {
  const playersById = new Map(input.players.map((p) => [p.id, p]));
  const sortedQuarters = [...input.quarters].sort((a, b) => a.index - b.index);

  const totals = new Tally();
  const unassigned = new Tally();
  const outside = new Tally();
  const byQuarter = new Map(sortedQuarters.map((q) => [q.index, new Tally()]));
  const byPlayer = new Map<
    string,
    { readonly player: ReportPlayer; readonly tally: Tally }
  >();

  for (const tag of input.tags) {
    const types = tagTypeKeys(tag).filter(isKnownType);
    if (types.length === 0) continue;

    totals.add(types);

    if (sortedQuarters.length > 0) {
      const quarter = quarterAt(sortedQuarters, tag.startS);
      (quarter ? byQuarter.get(quarter.index) : outside)?.add(types);
    }

    let linkedCount = 0;
    for (const playerId of new Set(tag.playerIds)) {
      const player = playersById.get(playerId);
      if (!player) continue;
      linkedCount += 1;
      let entry = byPlayer.get(playerId);
      if (!entry) {
        entry = { player, tally: new Tally() };
        byPlayer.set(playerId, entry);
      }
      entry.tally.add(types);
    }
    if (linkedCount === 0) unassigned.add(types);
  }

  const players = [...byPlayer.values()]
    .map(({ player, tally }) => ({ player, figures: tally.toRow() }))
    .sort((a, b) => compareRosterOrder(a.player, b.player));

  return {
    totals: totals.toRow(),
    quarters:
      sortedQuarters.length === 0
        ? null
        : {
            // The map was filled in quarter order, which iteration preserves.
            rows: [...byQuarter].map(([index, tally]) => ({
              index,
              figures: tally.toRow(),
            })),
            outside: outside.toRow(),
          },
    players,
    unassigned: unassigned.toRow(),
  };
}
