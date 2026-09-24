/**
 * One import pass over the Drive root (P2-17, ADR 0008).
 *
 * For every game folder that has no `ingest_folders` row yet, the pass waits
 * until the folder has been quiet for a while (its upload is done), picks and
 * orders its parts, reads each part's duration and the recording date, and
 * registers the game in the needs-a-name state. A folder whose files cannot be
 * ordered into a game is recorded as `rejected` with the reason, so it is not
 * looked at again.
 *
 * On the process's first pass, if nothing has ever been recorded, every folder
 * already on Drive is recorded as `skipped` instead of imported: games that
 * were entered by hand before the importer existed must not appear twice.
 * Deleting a folder's row makes the importer look at it again.
 *
 * The database, the filesystem and ffprobe come in through {@link ImporterDeps},
 * so the pass is unit-tested against fakes.
 */
import { selectGameParts } from "./parts";
import type { MediaProbe } from "./probe";
import { recordingDateFrom } from "./probe";
import type { FolderSnapshot } from "./scan";
import { QuietTracker } from "./scan";

/** One ordered part of a game about to be registered. */
export interface ImportedSource {
  /** Path relative to the source root: `<folder>/<file>`. */
  readonly filePath: string;
  readonly durationS: number;
}

/** What the importer reads from and writes to the database. */
export interface IngestRepository {
  /** Every folder that has a row, whatever its status. */
  recordedFolders(): Promise<Set<string>>;
  /** Record folders as `skipped` with a reason. */
  recordSkipped(folderPaths: readonly string[], detail: string): Promise<void>;
  /** Record a folder as `rejected` with a reason. */
  recordRejected(folderPath: string, reason: string): Promise<void>;
  /**
   * Create the needs-a-name game with its ordered sources and record the folder
   * as `imported`, all in one transaction.
   */
  registerGame(input: {
    folderPath: string;
    playedOn: string | null;
    sources: readonly ImportedSource[];
  }): Promise<{ gameId: string }>;
}

/** Where the pass reports what it did; `console` in production. */
export interface ImporterLog {
  info(message: string): void;
  warn(message: string): void;
}

export interface ImporterDeps {
  readonly repository: IngestRepository;
  /** List the candidate game folders under the source root. */
  readonly scan: () => Promise<FolderSnapshot[]>;
  /** Probe a part by its path relative to the source root. */
  readonly probe: (relativePath: string) => Promise<MediaProbe>;
  readonly now: () => Date;
  readonly log: ImporterLog;
  /** How long a folder must stay unchanged before it is imported. */
  readonly quietMs: number;
  /** First wait before re-probing a folder whose probe failed; doubles per failure. */
  readonly probeRetryMs: number;
}

/** What one pass did, for the log line and the tests. */
export interface ImportPassSummary {
  skipped: string[];
  imported: string[];
  rejected: string[];
  /** Folders seen but not settled yet (still uploading, or no parts yet). */
  waiting: string[];
}

/** The longest wait between two probe attempts on the same folder. */
const MAX_PROBE_RETRY_MS = 6 * 60 * 60 * 1000;

export const BASELINE_DETAIL =
  "already on Drive before the importer's first run";

/** Create an importer whose passes share the quiet-period and retry memory. */
export function createImporter(deps: ImporterDeps): {
  runPass(): Promise<ImportPassSummary>;
} {
  const tracker = new QuietTracker(deps.quietMs);
  const probeFailures = new Map<string, { count: number; retryAt: number }>();
  const reportedWaiting = new Set<string>();
  let firstPass = true;

  async function probeParts(
    folder: FolderSnapshot,
    parts: readonly string[],
  ): Promise<{ sources: ImportedSource[]; playedOn: string | null } | null> {
    const now = deps.now();
    const failure = probeFailures.get(folder.name);
    if (failure && now.getTime() < failure.retryAt) return null;

    const sources: ImportedSource[] = [];
    let playedOn: string | null = null;
    try {
      for (const part of parts) {
        const filePath = `${folder.name}/${part}`;
        const probe = await deps.probe(filePath);
        sources.push({ filePath, durationS: probe.durationS });
        playedOn ??= recordingDateFrom(probe.creationTime, now);
      }
    } catch (error) {
      const count = (failure?.count ?? 0) + 1;
      const waitMs = Math.min(
        deps.probeRetryMs * 2 ** (count - 1),
        MAX_PROBE_RETRY_MS,
      );
      probeFailures.set(folder.name, {
        count,
        retryAt: now.getTime() + waitMs,
      });
      deps.log.warn(
        `could not probe "${folder.name}" (attempt ${count}, retrying in ` +
          `${Math.round(waitMs / 60000)} min): ${String(error)}`,
      );
      return null;
    }
    probeFailures.delete(folder.name);
    return { sources, playedOn };
  }

  async function settle(
    folder: FolderSnapshot,
    summary: ImportPassSummary,
  ): Promise<void> {
    const selection = selectGameParts(folder.files.map((file) => file.name));

    if (selection.kind === "none") {
      summary.waiting.push(folder.name);
      if (!reportedWaiting.has(folder.name)) {
        reportedWaiting.add(folder.name);
        deps.log.info(`"${folder.name}" has no game parts yet, waiting`);
      }
      return;
    }

    if (selection.kind === "invalid") {
      await deps.repository.recordRejected(folder.name, selection.reason);
      tracker.forget(folder.name);
      summary.rejected.push(folder.name);
      deps.log.warn(`rejected "${folder.name}": ${selection.reason}`);
      return;
    }

    const probed = await probeParts(folder, selection.parts);
    if (!probed) {
      summary.waiting.push(folder.name);
      return;
    }

    const { gameId } = await deps.repository.registerGame({
      folderPath: folder.name,
      playedOn: probed.playedOn,
      sources: probed.sources,
    });
    tracker.forget(folder.name);
    summary.imported.push(folder.name);
    const ignored = selection.ignored.length
      ? `, ignored ${selection.ignored.join(", ")}`
      : "";
    deps.log.info(
      `imported "${folder.name}" as game ${gameId}: ` +
        `${probed.sources.length} ${selection.scheme} part(s), ` +
        `date ${probed.playedOn ?? "unknown"}${ignored}`,
    );
  }

  async function runPass(): Promise<ImportPassSummary> {
    const summary: ImportPassSummary = {
      skipped: [],
      imported: [],
      rejected: [],
      waiting: [],
    };
    const folders = await deps.scan();
    const recorded = await deps.repository.recordedFolders();

    if (firstPass && recorded.size === 0 && folders.length > 0) {
      firstPass = false;
      const names = folders.map((folder) => folder.name);
      await deps.repository.recordSkipped(names, BASELINE_DETAIL);
      summary.skipped.push(...names);
      deps.log.info(
        `first run: recorded ${names.length} existing folder(s) as skipped: ` +
          names.join(", "),
      );
      return summary;
    }
    firstPass = false;

    const now = deps.now();
    const present = new Set(folders.map((folder) => folder.name));
    tracker.retainOnly(present);
    for (const name of reportedWaiting) {
      if (!present.has(name) || recorded.has(name))
        reportedWaiting.delete(name);
    }

    for (const folder of folders) {
      if (recorded.has(folder.name)) continue;
      if (!tracker.observe(folder.name, folder.fingerprint, now)) {
        summary.waiting.push(folder.name);
        continue;
      }
      await settle(folder, summary);
    }
    return summary;
  }

  return { runPass };
}
