/**
 * Public surface of the instant jump-marker mode (P1-1). The watch page (P0-5)
 * mounts `LiveJumpMarkerNav` into the player's sidebar slot and
 * `LiveJumpMarkerTrack` into its timeline overlay; both derive their markers from
 * the shared live tag store, so tags captured in-session appear at once, and both
 * run inside the player's context and read the live controller. The pure
 * `JumpMarkerNav`/`JumpMarkerTrack` render a given marker list and the navigation
 * helpers back them - all unit-testable in isolation.
 */
export { JumpMarkerNav, type JumpMarkerNavProps } from "./JumpMarkerNav";
export { JumpMarkerTrack, type JumpMarkerTrackProps } from "./JumpMarkerTrack";
export { LiveJumpMarkerNav, LiveJumpMarkerTrack } from "./LiveJumpMarkers";
export {
  activeMarker,
  markerFraction,
  nextMarker,
  previousMarker,
  sortMarkers,
  type JumpMarker,
} from "./navigation";
export { jumpMarkersContent } from "./content";
