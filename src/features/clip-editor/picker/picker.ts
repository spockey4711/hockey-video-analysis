/**
 * The clip editor's picker (ADR 0011): every ready clip a coach can add to the
 * open collection, with filters for game, tag type and player. Built on the
 * server into display-ready clips plus the filter choices, then filtered in
 * the browser as the coach narrows it down. Pure, so the labels, the choices
 * and the filter are unit-tested on their own.
 */
import { formatGameTime } from "@/components/data/format-timecode";
import { collectionsContent } from "@/features/share/collections/content";
import { getTagType, TAG_TYPES } from "@/lib/tag-types";

/** One ready clip as the picker query returns it. */
export interface PickerClipRow {
  readonly id: string;
  readonly gameId: string;
  readonly gameTitle: string;
  readonly gameOpponent: string | null;
  readonly tagType: string;
  readonly startS: number;
  readonly isSingle: boolean;
  /** The players the clip's tag is linked to. */
  readonly playerIds: readonly string[];
}

/** One player as the picker query returns it. */
export interface PickerPlayerRow {
  readonly id: string;
  readonly name: string;
  readonly jerseyNumber: number | null;
}

/** One clip in the picker, display-ready. */
export interface PickerClip {
  readonly id: string;
  /** The tag type in German ("Tor"). */
  readonly title: string;
  /** Game, opponent and game-time mark, as in the collection's checklist. */
  readonly subtitle: string;
  readonly gameId: string;
  readonly tagType: string;
  readonly playerIds: readonly string[];
  /** A player-specific clip, flagged as in the checklist. */
  readonly isSingle: boolean;
  /** Already in the collection: one clip is at most one entry of it. */
  readonly inCollection: boolean;
}

/** One choice in a filter. */
export interface PickerOption {
  readonly value: string;
  readonly label: string;
}

/** What the picker shows: the clips and the choices of each filter. */
export interface PickerData {
  readonly clips: readonly PickerClip[];
  readonly games: readonly PickerOption[];
  readonly tagTypes: readonly PickerOption[];
  readonly players: readonly PickerOption[];
}

/** The picker's filters; an empty string matches every clip. */
export interface PickerFilter {
  readonly gameId: string;
  readonly tagType: string;
  readonly playerId: string;
}

export const NO_FILTER: PickerFilter = {
  gameId: "",
  tagType: "",
  playerId: "",
};

function gameLabel(row: PickerClipRow): string {
  return row.gameOpponent
    ? `${row.gameTitle} ${collectionsContent.coach.detail.opponentPrefix} ${row.gameOpponent}`
    : row.gameTitle;
}

function tagTypeLabel(key: string): string {
  return getTagType(key)?.label ?? key;
}

/** Where a tag type sorts: the configured order, unknown types after it. */
function tagTypeRank(key: string): number {
  const index = TAG_TYPES.findIndex((type) => type.key === key);
  return index === -1 ? TAG_TYPES.length : index;
}

function playerLabel(player: PickerPlayerRow): string {
  return player.jerseyNumber === null
    ? player.name
    : `${player.jerseyNumber} ${player.name}`;
}

/**
 * Build the picker from the ready clips (in play order, from the query), the
 * team's players and the ids already in the collection. Each filter offers
 * only what some clip matches: the games and tag types that have a ready
 * clip, and the players linked to one. Games keep the clips' order (newest
 * first), tag types the configured order, players sort by shirt number, then
 * name.
 */
export function toPickerData(
  rows: readonly PickerClipRow[],
  players: readonly PickerPlayerRow[],
  memberIds: ReadonlySet<string>,
): PickerData {
  const games = new Map<string, string>();
  const tagTypes = new Set<string>();
  const linked = new Set<string>();
  for (const row of rows) {
    if (!games.has(row.gameId)) games.set(row.gameId, gameLabel(row));
    tagTypes.add(row.tagType);
    for (const id of row.playerIds) linked.add(id);
  }

  return {
    clips: rows.map((row) => ({
      id: row.id,
      title: tagTypeLabel(row.tagType),
      subtitle: [gameLabel(row), formatGameTime(row.startS).main].join(" - "),
      gameId: row.gameId,
      tagType: row.tagType,
      playerIds: row.playerIds,
      isSingle: row.isSingle,
      inCollection: memberIds.has(row.id),
    })),
    games: [...games].map(([value, label]) => ({ value, label })),
    tagTypes: [...tagTypes]
      .sort((a, b) => tagTypeRank(a) - tagTypeRank(b) || a.localeCompare(b))
      .map((key) => ({ value: key, label: tagTypeLabel(key) })),
    players: players
      .filter((player) => linked.has(player.id))
      .sort(
        (a, b) =>
          (a.jerseyNumber ?? Infinity) - (b.jerseyNumber ?? Infinity) ||
          a.name.localeCompare(b.name, "de"),
      )
      .map((player) => ({ value: player.id, label: playerLabel(player) })),
  };
}

/** The clips matching every set filter, in their order. */
export function filterPickerClips(
  clips: readonly PickerClip[],
  filter: PickerFilter,
): PickerClip[] {
  return clips.filter(
    (clip) =>
      (filter.gameId === "" || clip.gameId === filter.gameId) &&
      (filter.tagType === "" || clip.tagType === filter.tagType) &&
      (filter.playerId === "" || clip.playerIds.includes(filter.playerId)),
  );
}
