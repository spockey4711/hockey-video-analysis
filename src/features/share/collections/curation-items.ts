/**
 * Pure display mapper for the coach curation checklist (P2-13). Turns raw ready
 * clip rows into checkbox items with German labels built the same way the share
 * playlist builds them (tag-type label + game + timecode), plus the current
 * checked state. Kept pure and server-safe so the editor client component only
 * receives display-ready strings and the label logic stays unit-testable.
 */
import { collectionsContent } from "./content";
import type { CurationClipRow } from "./queries";

import { formatGameTime } from "@/components/data/format-timecode";
import { getTagType } from "@/lib/tag-types";

/** One row in the curation checklist: display-ready and pre-marked. */
export interface CurationItem {
  readonly id: string;
  /** Primary label: the tag type in German ("Tor"). */
  readonly title: string;
  /** Secondary label: game, opponent (if any) and the game-time mark. */
  readonly subtitle: string;
  /** True for a player-specific clip, so the editor can flag it. */
  readonly isSingle: boolean;
  /** Whether the clip is currently in the collection (checkbox default). */
  readonly checked: boolean;
}

function buildSubtitle(row: CurationClipRow): string {
  const parts = [
    row.gameTitle,
    row.gameOpponent
      ? `${collectionsContent.coach.detail.opponentPrefix} ${row.gameOpponent}`
      : null,
    formatGameTime(row.startS).main,
  ];
  return parts.filter((part): part is string => part !== null).join(" - ");
}

/**
 * Build the checklist items from the ready clips and the ids already in the
 * collection. Input order (chronological, from the query) is preserved. An
 * unknown tag type falls back to its stored key so the label never blanks.
 */
export function toCurationItems(
  rows: readonly CurationClipRow[],
  selectedIds: ReadonlySet<string>,
): CurationItem[] {
  return rows.map((row) => ({
    id: row.id,
    title: getTagType(row.tagType)?.label ?? row.tagType,
    subtitle: buildSubtitle(row),
    isSingle: row.isSingle,
    checked: selectedIds.has(row.id),
  }));
}

/**
 * The member clips a checklist save takes out of the collection: the clips the
 * checklist listed that the coach left unticked. The checklist lists ready clips
 * only, so a member that was not ready when the page rendered - being re-cut
 * after a window edit, or failed - was never the coach's to untick. It stays a
 * member, and keeps its notes, until it is ready again and shows up in the list.
 */
export function clipsToRemove(
  listedIds: readonly string[],
  checkedIds: readonly string[],
): string[] {
  const checked = new Set(checkedIds);
  return listedIds.filter((id) => !checked.has(id));
}
