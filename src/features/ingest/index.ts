/**
 * Public surface of the Drive importer (P2-17, ADR 0008). The importer is a
 * separate long-running process next to the clip worker: it watches the
 * read-only Drive mount for new game folders, registers each settled folder as
 * a needs-a-name game, and encodes the 720p tagging proxies. Its composition
 * root is `scripts/ingest-worker.ts`.
 */
export {
  selectGameParts,
  type GamePartsResult,
  type PartScheme,
} from "./parts";
export {
  buildProbeArgs,
  parseProbeOutput,
  probeMedia,
  ProbeError,
  recordingDateFrom,
  type MediaProbe,
  type ProbeOptions,
} from "./probe";
