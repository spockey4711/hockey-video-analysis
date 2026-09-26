/**
 * Public surface of the team clip share view (P0-10): the token guard, the ready
 * team-clip query, the display mapper and the page copy. The route composes
 * these; the token lives in `team_settings` (seeded once from the env).
 *
 * The coach-facing surfaces also live here: {@link TeamShareLink} copies the
 * link on the roster (P2-4), {@link TeamShareSettings} creates or replaces it
 * under Einstellungen > Teilen.
 */
export {
  getTeamShareToken,
  regenerateTeamShareToken,
  verifyTeamShareToken,
} from "./token";
export { listReadyTeamClips, type TeamClipRow } from "./queries";
export { toPlaylistItems } from "./clip-items";
export { teamShareContent } from "./content";
export { teamSharePath, teamShareUrl } from "./share-link";
export {
  TeamShareLink,
  TeamShareLinkSkeleton,
  TeamShareSettings,
} from "./TeamShareLink";
