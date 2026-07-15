/**
 * Public surface of the tagging feature (P0-6). The watch page mounts
 * `TaggingPanel` into the player's tagging slot; it wires the live player
 * controller into the `HotkeyTagger` capture leaf. The pure `captureTag` helper
 * is exported for callers that need the default-window math without the UI.
 */
export {
  HotkeyTagger,
  type HotkeyTaggerProps,
  type CapturedTagResult,
} from "./HotkeyTagger";
export { TaggingPanel, type TaggingPanelProps } from "./TaggingPanel";
export { captureTag, formatClock, type CapturedTag } from "./capture";
export { taggingContent } from "./content";
