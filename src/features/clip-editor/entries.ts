/**
 * The clip editor's entries (ADR 0011): one per clip in the collection, built
 * on the server into the display-ready shape the editor's client component
 * works with - German labels, a loadable media URL, and the times the editor
 * needs to place a trim. Pure, so the mapping is unit-tested on its own.
 */
import { formatGameTime } from "@/components/data/format-timecode";
import type { ClipEdit, TimeRange } from "@/features/clip-edits";
import type { ClipStatus } from "@/features/clips/status";
import { resolveSourceUrl } from "@/features/player/player-sources";
import { collectionsContent } from "@/features/share/collections/content";
import { getTagType } from "@/lib/tag-types";

/** One clip in the collection as the editor query returns it. */
export interface EditorEntryRow {
  readonly id: string;
  readonly status: ClipStatus;
  readonly outputPath: string | null;
  readonly cutStartS: number | null;
  readonly tagId: string;
  readonly tagType: string;
  readonly startS: number;
  readonly window: TimeRange;
  readonly isSingle: boolean;
  readonly gameTitle: string;
  readonly gameOpponent: string | null;
  readonly gameDurationS: number;
  /** Frames per second of the chapter the clip starts in, null when unknown. */
  readonly frameRate: number | null;
  readonly edit: ClipEdit | null;
  readonly version: number;
}

/** One clip in the editor, display-ready. */
export interface EditorEntry {
  /** The clip id. */
  readonly id: string;
  /** The tag the clip is cut from; lengthening edits its window. */
  readonly tagId: string;
  readonly tagType: string;
  /** The tag type in German ("Tor"). */
  readonly title: string;
  /** Game, opponent and game-time mark. */
  readonly subtitle: string;
  readonly isSingle: boolean;
  readonly status: ClipStatus;
  /** The clip file's URL, or null while no file is cut. */
  readonly src: string | null;
  /** The tag window in game time: the footage the file holds. */
  readonly window: TimeRange;
  /** The game time at clip-file time 0, or null until the worker probed it. */
  readonly cutStartS: number | null;
  /** How long the game runs; a window never reaches past it. */
  readonly gameDurationS: number;
  /** The clip's frames per second, the size of a frame step; null when unknown. */
  readonly frameRate: number | null;
  readonly edit: ClipEdit | null;
  /** The save version the next save must name. */
  readonly version: number;
}

function subtitleOf(row: EditorEntryRow): string {
  return [
    row.gameTitle,
    row.gameOpponent
      ? `${collectionsContent.coach.detail.opponentPrefix} ${row.gameOpponent}`
      : null,
    formatGameTime(row.startS).main,
  ]
    .filter((part): part is string => part !== null)
    .join(" - ");
}

/** Build the editor's entries, keeping the query's play order. */
export function toEditorEntries(
  rows: readonly EditorEntryRow[],
  mediaBaseUrl: string | undefined,
): EditorEntry[] {
  return rows.map((row) => ({
    id: row.id,
    tagId: row.tagId,
    tagType: row.tagType,
    title: getTagType(row.tagType)?.label ?? row.tagType,
    subtitle: subtitleOf(row),
    isSingle: row.isSingle,
    status: row.status,
    src:
      row.outputPath === null
        ? null
        : resolveSourceUrl(row.outputPath, mediaBaseUrl),
    window: row.window,
    cutStartS: row.cutStartS,
    gameDurationS: row.gameDurationS,
    frameRate: row.frameRate,
    edit: row.edit,
    version: row.version,
  }));
}
