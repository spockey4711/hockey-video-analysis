/**
 * Telestration (P2-10): drawing arrows, curved arrows, circles and freehand
 * lines (solid or dotted) on a paused frame and exporting the annotated still.
 * This is its public surface for two hosts: the watch player
 * ({@link ContinuousPlayer}) and presentation mode on the share links, which
 * draws the same way but leaves out the still export, and shows the drawing
 * read-only on its audience window. Each host owns its video
 * and passes it in; nothing here reads the watch player's context, so hosts
 * outside the player import only this entry point.
 */
export { TelestrationLayer, TelestrationView } from "./TelestrationLayer";
export { TelestrationToolbar } from "./TelestrationToolbar";
export { telestrationContent } from "./content";
export { useTelestration, type Telestration } from "./use-telestration";
