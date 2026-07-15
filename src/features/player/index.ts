/**
 * Public surface of the player feature. The watch page composes the player from
 * these; sibling lanes (P0-6 tagging, P1-4 quarters) import the controller hook
 * and slot types to fill the player's typed slots.
 */
export { ContinuousPlayer } from "./ContinuousPlayer";
export type { ContinuousPlayerProps, PlayerSlots } from "./ContinuousPlayer";
export { usePlayerController } from "./PlayerContext";
export type { PlayerController } from "./PlayerContext";
export { toPlayerSources } from "./player-sources";
export type { ChapterInput, PlayerSource } from "./player-sources";
export { formatGameClock } from "./format-timecode";
export { playerContent } from "./content";
