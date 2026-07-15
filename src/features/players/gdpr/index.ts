/**
 * Public surface of player erasure (P1-6, PRD s8 - GDPR right to erasure).
 * Deleting a player takes their personal data with them: their tag links and
 * their own `single` clips (a `single` clip shared with another player is kept).
 * Team tags and clips are team data and always stay.
 *
 * The roster surface (`@/features/players/roster`) mounts the confirm-gated
 * `DeletePlayerForm` against `deletePlayerAction`; the action is coach-guarded
 * and returns a summary of what was removed. `queries` is `server-only`; import
 * it from server code or tests, not a client component.
 */
export { DeletePlayerForm } from "./DeletePlayerForm";
export { deletePlayerAction } from "./actions";
export { deletePlayerInitialState, type DeletePlayerState } from "./state";
export { deletePlayerWithData, type PlayerDeletionSummary } from "./queries";
export { isValidPlayerId } from "./validation";
export { gdprContent } from "./content";
