/**
 * Public surface of the Drive importer (P2-17, ADR 0008). The importer is a
 * separate long-running process next to the clip worker: it watches the
 * read-only Drive mount for new game folders, registers each settled folder as
 * a needs-a-name game, and encodes the 720p tagging proxies. Its composition
 * root is `scripts/ingest-worker.ts`.
 */
export {
  BASELINE_DETAIL,
  createImporter,
  type ImportedSource,
  type ImporterDeps,
  type ImporterLog,
  type ImportPassSummary,
  type IngestRepository,
} from "./importer";
export {
  buildProxyArgs,
  createProxyEncoder,
  encodeProxy,
  PROXY_DURATION_TOLERANCE_S,
  ProxyError,
  resolveInside,
  temporaryProxyPath,
  type EncodeProxyOptions,
  type ProxyEncoderDeps,
  type ProxyEncoderLog,
  type ProxySource,
  type ProxySourceList,
} from "./proxy";
export { createIngestRepository } from "./repository";
export {
  fingerprintFiles,
  QuietTracker,
  scanSourceRoot,
  type FolderFile,
  type FolderSnapshot,
} from "./scan";
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
