/**
 * Public surface of the per-player clip share view (P0-11): the share-token
 * player lookup, the ready-clip query, the display mapper and the page copy. The
 * route composes these and renders the shared `PlaylistPlayer` (P0-10); the
 * schema stays untouched (P0-1) - this lane only adds reads keyed by the
 * existing `players.share_token`.
 */
export {
  getPlayerByShareToken,
  listReadyClipsForPlayer,
  type SharePlayer,
  type PlayerClipRow,
} from "./queries";
export { toPlaylistItems } from "./clip-items";
export { playerShareContent } from "./content";
