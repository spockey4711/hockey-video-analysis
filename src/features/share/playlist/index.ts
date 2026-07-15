/**
 * Public surface of the shared playlist player (P0-10). The team link (P0-10)
 * and per-player link (P0-11) both import {@link PlaylistPlayer} from here and
 * feed it a {@link PlaylistItem} list they built server-side.
 */
export { PlaylistPlayer, type PlaylistPlayerProps } from "./PlaylistPlayer";
export type { PlaylistItem } from "./types";
export {
  clampIndex,
  isLast,
  nextIndex,
  prevIndex,
} from "./playlist-navigation";
export { playlistContent } from "./content";
