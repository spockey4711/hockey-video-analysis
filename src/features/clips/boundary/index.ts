/**
 * Public surface of the clip-boundary feature (P1-7). Resolves a tag's global
 * clip window into the per-file cut plan the pipeline worker copies and
 * concatenates, handling windows that cross a chapter seam cleanly instead of
 * clamping at the edge (ADR 0002/0004, PRD s3 risk 2).
 */
export {
  planClipCut,
  type ClipSource,
  type ClipSourceCut,
  type ClipCutPlan,
} from "./cut-plan";
