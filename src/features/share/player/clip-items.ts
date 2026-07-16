/**
 * Map ready clips into the player's {@link PlaylistItem} list (P0-11). Like the
 * team view's mapper (P0-10), this is the pure, server-side display layer: it
 * builds each item's German label and resolves the stored NAS `output_path` into
 * a loadable URL, so the login-free client only ever receives display-ready
 * strings, never a tag-type key or a raw file path. Each share view owns its own
 * mapper (see {@link PlaylistItem}); this one is view-agnostic in output but
 * stays in the player lane.
 */
import { playerShareContent } from "./content";
import type { PlayerClipRow } from "./queries";

import { formatGameTime } from "@/components/data/format-timecode";
import { resolveSourceUrl } from "@/features/player/player-sources";
import type { PlaylistItem } from "@/features/share/playlist";
import { getTagType } from "@/lib/tag-types";

/** Build one clip's subtitle: game, opponent (if any) and the game-time mark. */
function buildSubtitle(row: PlayerClipRow): string {
  const parts = [
    row.gameTitle,
    row.gameOpponent
      ? `${playerShareContent.opponentPrefix} ${row.gameOpponent}`
      : null,
    formatGameTime(row.startS).main,
  ];
  return parts.filter((part): part is string => part !== null).join(" - ");
}

/**
 * Turn ready clip rows into playlist items, resolving each `outputPath` against
 * `mediaBaseUrl` (the same media-base contract the watch player uses). A clip's
 * title is its tag type's German label; unknown types fall back to the stored
 * key so a retuned type never blanks the label. Input order is preserved.
 */
export function toPlaylistItems(
  rows: readonly PlayerClipRow[],
  mediaBaseUrl: string | undefined,
): PlaylistItem[] {
  return rows.map((row) => ({
    id: row.id,
    src: resolveSourceUrl(row.outputPath, mediaBaseUrl),
    title: getTagType(row.tagType)?.label ?? row.tagType,
    subtitle: buildSubtitle(row),
  }));
}
