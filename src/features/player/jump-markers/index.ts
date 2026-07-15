/**
 * Public surface of the instant jump-marker mode (P1-1). The watch page (P0-5)
 * loads a game's markers via `listJumpMarkers`, then mounts `JumpMarkerNav` into
 * the player's sidebar slot and `JumpMarkerTrack` into its timeline overlay -
 * both run inside the player's context and read the live controller. The pure
 * navigation helpers back both and are unit-testable in isolation.
 */
export { JumpMarkerNav, type JumpMarkerNavProps } from "./JumpMarkerNav";
export { JumpMarkerTrack, type JumpMarkerTrackProps } from "./JumpMarkerTrack";
export {
  activeMarker,
  markerFraction,
  nextMarker,
  previousMarker,
  sortMarkers,
  type JumpMarker,
} from "./navigation";
export { jumpMarkersContent } from "./content";
