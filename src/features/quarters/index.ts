/**
 * Public surface of the quarter split feature (P1-4). The watch page (P0-5)
 * mounts `QuarterEditor` into the player's sidebar slot and `QuarterMarkers`
 * into its timeline overlay; the clip flow (P0-9) reads `quarterWindow` for
 * per-quarter clip creation. Pages load persisted quarters via `listQuarters`.
 */
export { QuarterEditor, type QuarterEditorProps } from "./QuarterEditor";
export { QuarterMarkers, type QuarterMarkersProps } from "./QuarterMarkers";
export {
  QuarterClockProvider,
  type QuarterClockProviderProps,
} from "./QuarterClockProvider";
export {
  quarterAt,
  quarterBands,
  quarterWindow,
  type Quarter,
  type QuarterBand,
  type QuarterWindow,
} from "./navigation";
export { QUARTER_LENGTH_S, quarterClockS } from "./clock";
export { quartersContent } from "./content";
