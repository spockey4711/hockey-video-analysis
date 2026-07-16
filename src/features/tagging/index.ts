/**
 * Public surface of the tagging feature (P0-6). The watch page wraps the player
 * in `GameTagsProvider` (the live tag store), mounts `TransportTagButtons` into
 * the transport slot for hotkey/click capture, and `TaggingPanel` for the
 * editable tag list; both drive the store. The pure `captureTag` helper is
 * exported for callers that need the default-window math without the UI.
 */
export {
  GameTagsProvider,
  useGameTags,
  type GameTagsController,
  type GameTagsProviderProps,
} from "./GameTagsProvider";
export {
  TransportTagButtons,
  type TransportTagButtonsProps,
} from "./TransportTagButtons";
export {
  useTagCapture,
  type CapturedTagResult,
  type UseTagCaptureOptions,
} from "./use-tag-capture";
export { captureTag, formatClock, type CapturedTag } from "./capture";
export { taggingContent } from "./content";
