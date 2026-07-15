/**
 * Public surface of the tagging feature (P0-6). The watch page wraps the player
 * in `GameTagsProvider` (the live tag store) and mounts `TaggingPanel` into the
 * player's tagging slot; the panel wires the live player controller into the
 * `HotkeyTagger` capture leaf and drives the store. The pure `captureTag` helper
 * is exported for callers that need the default-window math without the UI.
 */
export {
  GameTagsProvider,
  useGameTags,
  type GameTagsController,
  type GameTagsProviderProps,
} from "./GameTagsProvider";
export {
  HotkeyTagger,
  type HotkeyTaggerProps,
  type CapturedTagResult,
} from "./HotkeyTagger";
export { TaggingPanel, type TaggingPanelProps } from "./TaggingPanel";
export { captureTag, formatClock, type CapturedTag } from "./capture";
export { taggingContent } from "./content";
