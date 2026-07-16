/**
 * Watch-page mounting surface for the quarter overlay (UX-4). The connector that
 * bridges the live player controller into the presentational `QuarterMarkers`
 * lives here; the watch page mounts it into the player's `timelineOverlay` slot.
 * The editor panel (`QuarterEditor`, from the feature root) self-connects to the
 * controller and needs no bridge.
 */
export {
  QuarterTimelineOverlay,
  type QuarterTimelineOverlayProps,
} from "./QuarterTimelineOverlay";
export {
  QuarterTimelineLabels,
  type QuarterTimelineLabelsProps,
} from "./QuarterTimelineLabels";
