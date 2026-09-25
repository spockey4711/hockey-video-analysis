/**
 * Public surface of roster setup: the coach adds players and edits an existing
 * player's name and jersey number. A new player gets a fresh secret share link
 * from the rotation token generator; editing never touches that link.
 *
 * The roster page mounts `AddPlayerForm` above the list and each row mounts
 * `EditablePlayerName`; both post to coach-guarded server actions that validate
 * with `validatePlayer` before any query runs. `queries` is `server-only`;
 * import it from server code or tests, not a client component.
 */
export { AddPlayerForm } from "./AddPlayerForm";
export { EditablePlayerName } from "./EditablePlayerName";
export { createPlayerAction, updatePlayerAction } from "./actions";
export { playerFormInitialState, type PlayerFormState } from "./state";
export { createPlayer, updatePlayer } from "./queries";
export {
  validatePlayer,
  NAME_MAX_LENGTH,
  JERSEY_MIN,
  JERSEY_MAX,
  type PlayerFieldErrors,
  type RawPlayerInput,
  type ValidatedPlayer,
} from "./validation";
export { playerSetupContent } from "./content";
