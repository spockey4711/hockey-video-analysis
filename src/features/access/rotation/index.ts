/**
 * Public surface of share-token rotation (P1-6). Rotating a player's
 * `share_token` writes a fresh unguessable value over the old one, which revokes
 * the previously shared secret link (it stops resolving) - the coach-facing way
 * to kill a leaked or stale per-player link.
 *
 * A future players-admin surface mounts a form against `rotateShareTokenAction`;
 * the action is coach-guarded and returns the fresh token so the caller can show
 * the new link. `queries` and `token` are `server-only`; import them from server
 * code or tests, not a client component.
 */
export {
  rotateShareTokenAction,
  rotateShareTokenInitialState,
  type RotateShareTokenState,
} from "./actions";
export { rotatePlayerShareToken, type RotatedShareToken } from "./queries";
export { generateShareToken } from "./token";
export { isValidPlayerId } from "./validation";
export { rotationContent } from "./content";
