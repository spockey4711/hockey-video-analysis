/**
 * Map a collection's ready clips into the shared {@link PlaylistItem} list
 * (P2-13). Like the team and per-player mappers, this is the pure, server-side
 * display layer: it builds each item's German label and resolves the stored NAS
 * `output_path` into a loadable URL, so the login-free client only ever receives
 * display-ready strings, never a tag-type key or a raw file path. Input order is
 * preserved, so the chronological order the query returns is the play order.
 *
 * Every clip also gets its playback plan (ADR 0011): the coach's edit for the
 * collection, or the plain tag window, on the clip file's clock.
 */
import { collectionsContent } from "./content";
import { mergeEntries } from "./entries";
import type { SceneEntryRow } from "./scene-entries";
import type { CollectionClipRow } from "./share-queries";

import { formatGameTime } from "@/components/data/format-timecode";
import { toPlaybackPlan } from "@/features/clip-edits";
import { resolveSourceUrl } from "@/features/player/player-sources";
import type { PlaylistItem } from "@/features/share/playlist";
import type {
  PlaylistEntry,
  ScenePlaylistItem,
} from "@/features/share/playlist/types";
import { sceneDuration } from "@/features/tactics/animation";
import { withoutRosterLinks } from "@/features/tactics/scene";
import { getTagType } from "@/lib/tag-types";

/** Build one clip's subtitle: game, opponent (if any) and the game-time mark. */
function buildSubtitle(row: CollectionClipRow): string {
  const parts = [
    row.gameTitle,
    row.gameOpponent
      ? `${collectionsContent.share.opponentPrefix} ${row.gameOpponent}`
      : null,
    formatGameTime(row.startS).main,
  ];
  return parts.filter((part): part is string => part !== null).join(" - ");
}

/**
 * Turn ready clip rows into playlist items, resolving each `outputPath` against
 * `mediaBaseUrl` (the same media-base contract the watch player uses). A clip's
 * title is its tag type's German label; unknown types fall back to the stored
 * key so a retuned type never blanks the label. `coachComments` maps a clip id
 * to the coach's most recent comment on it, which the players show
 * under the title; a clip without one gets no `coachComment`. A clip's team
 * note becomes its `teamNote`; a clip without one gets none. Input order is
 * preserved.
 */
export function toPlaylistItems(
  rows: readonly CollectionClipRow[],
  mediaBaseUrl: string | undefined,
  coachComments: ReadonlyMap<string, { readonly body: string }> = new Map(),
): PlaylistItem[] {
  return rows.map((row) => {
    const coachComment = coachComments.get(row.id)?.body;
    return {
      id: row.id,
      src: resolveSourceUrl(row.outputPath, mediaBaseUrl),
      title: getTagType(row.tagType)?.label ?? row.tagType,
      subtitle: buildSubtitle(row),
      ...(coachComment === undefined ? {} : { coachComment }),
      ...(row.teamNote ? { teamNote: row.teamNote } : {}),
      plan: toPlaybackPlan(row.edit, row.timeline),
      frameRate: row.frameRate,
    };
  });
}

/**
 * Turn a scene entry into what the link plays (ADR 0014): the scene's name,
 * whether it is still or animated, and the scene without its roster links.
 * Nothing else about the scene or its author reaches the link.
 */
export function toSceneItem(row: SceneEntryRow): ScenePlaylistItem {
  const seconds = sceneDuration(row.scene);
  return {
    kind: "scene",
    id: row.id,
    title: row.name,
    subtitle:
      seconds > 0
        ? collectionsContent.share.scene.animated(seconds)
        : collectionsContent.share.scene.still,
    scene: withoutRosterLinks(row.scene),
    holdS: row.holdS,
  };
}

/**
 * The collection's whole play order: the clips as {@link toPlaylistItems}
 * builds them, with each scene entry placed between them.
 */
export function toPlaylistEntries(
  rows: readonly CollectionClipRow[],
  scenes: readonly SceneEntryRow[],
  mediaBaseUrl: string | undefined,
  coachComments: ReadonlyMap<string, { readonly body: string }> = new Map(),
): PlaylistEntry[] {
  const clips = toPlaylistItems(rows, mediaBaseUrl, coachComments);
  const ordered = rows.map((row, index) => ({
    id: row.id,
    key: { playedOn: row.playedOn, startS: row.startS },
    item: clips[index] as PlaylistItem,
  }));
  return mergeEntries(ordered, scenes).map((entry) =>
    entry.kind === "clip" ? entry.clip.item : toSceneItem(entry.scene),
  );
}
