/**
 * Public surface of the tagging feature (P0-6). The watch page (P0-5) mounts
 * `HotkeyTagger` into its tagging slot; the pure `captureTag` helper is exported
 * for callers that need the default-window math without the UI.
 */
export {
  HotkeyTagger,
  type HotkeyTaggerProps,
  type CapturedTagResult,
} from "./HotkeyTagger";
export { captureTag, formatClock, type CapturedTag } from "./capture";
export { taggingContent } from "./content";
