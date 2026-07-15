/**
 * Public surface of the login-free share shell. P0-10 (team link) and P0-11
 * (per-player link) import the chrome, state blocks and `noindex` metadata from
 * here and render their `PlaylistPlayer` as `ShareShell` children. Keep the
 * shell nav-free so no secret-link recipient can reach coach surfaces or another
 * player's clips.
 */
export { ShareShell, type ShareShellProps } from "./ShareShell";
export {
  ShareMessage,
  ShareEmptyState,
  ShareExpiredState,
  ShareLoading,
} from "./ShareStates";
export { shareMetadata, shareRobots } from "./metadata";
export { shareContent } from "./content";
