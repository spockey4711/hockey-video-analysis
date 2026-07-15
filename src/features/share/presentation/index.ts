/**
 * Public surface of presentation mode (P1-8). The share views drop
 * {@link PresentationMode} beside their {@link PlaylistPlayer}, feeding it the
 * same server-built {@link PlaylistItem} list.
 */
export {
  PresentationMode,
  type PresentationModeProps,
} from "./PresentationMode";
export { presentationContent } from "./content";
export {
  enterFullscreen,
  exitFullscreen,
  isFullscreenActive,
  isFullscreenSupported,
} from "./fullscreen";
