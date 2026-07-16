/**
 * Public surface of the team clip share view (P0-10): the token guard, the ready
 * team-clip query, the display mapper and the page copy. The route composes
 * these; the schema stays untouched (P0-1) - this lane only adds reads and the
 * env-backed team token.
 *
 * The coach-facing {@link TeamShareLink} surface (P2-4) also lives here so the
 * team link is copyable from the coach app, not hand-built.
 */
export { getTeamShareToken, verifyTeamShareToken } from "./token";
export { listReadyTeamClips, type TeamClipRow } from "./queries";
export { toPlaylistItems } from "./clip-items";
export { teamShareContent } from "./content";
export { teamSharePath, teamShareUrl } from "./share-link";
export { TeamShareLink } from "./TeamShareLink";
