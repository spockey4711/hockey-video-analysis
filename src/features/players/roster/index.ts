/**
 * Public surface of the coach-only roster (P1-6 UI). The roster page lists team
 * players and mounts, per row, the share-token rotation form (from
 * `@/features/access/rotation`) and the erasure form (from
 * `@/features/players/gdpr`). `queries` is `server-only`; import it from server
 * code or tests, not a client component. `share-link` and `content` are pure and
 * safe to import from either side.
 */
export { listPlayers, type PlayerRosterItem } from "./queries";
export { playerSharePath, playerShareUrl } from "./share-link";
export { rosterContent } from "./content";
