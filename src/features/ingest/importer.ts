/**
 * One import pass over the Drive root (P2-17, ADR 0008).
 *
 * For every game folder that has no `ingest_folders` row yet, the pass waits
 * until the folder has been quiet for a while (its upload is done), picks and
 * orders its parts, reads each part's duration and the recording date, and
 * registers the game in the needs-a-name state. A folder whose files cannot be
 * ordered into a game is recorded as `rejected` with the reason.
 *
 * A folder that has a row is not imported again, but two kinds are still
 * watched, because an upload can stall for longer than the quiet period:
 *
 * - A `rejected` folder is looked at again once its parts change: a part that
 *   finished uploading after a later one first shows up as a gap.
 * - An `imported` folder whose parts grow after the import (a late chapter) has
 *   the new parts appended to its game, but only while the game is still in
 *   the "Neu eingegangen" review and only when the game's chapters stay the
 *   first parts in play order. Any other change - the game has been accepted,
 *   a part was removed or renamed, a part now sorts before the imported ones -
 *   leaves the game alone: the change is written to the row's `detail` and
 *   logged, so the operator can act on it.
 *
 * On the process's first pass, if nothing has ever been recorded, every folder
 * already on Drive is recorded as `skipped` instead of imported: games that
 * were entered by hand before the importer existed must not appear twice.
 * Deleting a folder's row makes the importer look at it again.
 *
 * The database, the filesystem and ffprobe come in through {@link ImporterDeps},
 * so the pass is unit-tested against fakes.
 */
import { selectGameParts, type GamePartsResult } from "./parts";
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

/** The game an `imported` folder became, as it is now. */
export interface ImportedGame {
  readonly id: string;
  /** Still in the "Neu eingegangen" review: the coach has not accepted it. */
  readonly underReview: boolean;
  /** Its chapters' paths relative to the source root, in play order. */
  readonly filePaths: readonly string[];
}

/** What the database holds about a folder that has an `ingest_folders` row. */
export type RecordedFolder =
  | { readonly status: "skipped" }
  | { readonly status: "rejected"; readonly detail: string | null }
  | {
      readonly status: "imported";
      readonly detail: string | null;
      /** Null once the game has been deleted (discarded in the review). */
      readonly game: ImportedGame | null;
    };

/** What the importer reads from and writes to the database. */
export interface IngestRepository {
  /** Every folder that has a row, whatever its status, by folder path. */
  recordedFolders(): Promise<Map<string, RecordedFolder>>;
  /** Record folders as `skipped` with a reason. */
  recordSkipped(folderPaths: readonly string[], detail: string): Promise<void>;
  /**
   * Record a folder as `rejected` with a reason, or update the reason of a
   * folder that is already rejected.
   */
  recordRejected(folderPath: string, reason: string): Promise<void>;
  /**
   * Create the needs-a-name game with its ordered sources and record the folder
   * as `imported`, all in one transaction. A folder that was `rejected` before
   * becomes `imported`; any other existing row fails the call.
   */
  registerGame(input: {
    folderPath: string;
    playedOn: string | null;
    sources: readonly ImportedSource[];
  }): Promise<{ gameId: string }>;
  /**
   * Append late parts to an imported game and clear the folder's `detail`, in
   * one transaction - but only while the game is still under review and its
   * chapters are still exactly `knownFilePaths`. Resolves whether it appended.
   */
  appendSources(input: {
    folderPath: string;
    gameId: string;
    knownFilePaths: readonly string[];
    sources: readonly ImportedSource[];
  }): Promise<boolean>;
  /** Set or clear the `detail` of an imported folder. */
  recordDetail(folderPath: string, detail: string | null): Promise<void>;
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
  /** Imported folders whose late parts were appended to their game. */
  appended: string[];
  /** Imported folders newly found changed in a way the importer leaves alone. */
  flagged: string[];
  /** Folders seen but not settled yet (still uploading, or no parts yet). */
  waiting: string[];
}

/** Whether two lists hold the same strings in the same order. */
function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && startsWith(a, b);
}

/** Whether `list` begins with every entry of `prefix`, in order. */
function startsWith(
  list: readonly string[],
  prefix: readonly string[],
): boolean {
  return (
    prefix.length <= list.length &&
    prefix.every((entry, index) => list[index] === entry)
  );
}

/**
 * Why an imported folder's change is not applied to its game, for the row's
 * `detail` and the log. `lateParts` is set when the folder only grew.
 */
function describeChange(
  selection: GamePartsResult,
  lateParts: readonly string[] | null,
): string {
  if (lateParts) {
    return `new part(s) after the game was accepted, not added: ${lateParts.join(", ")}`;
  }
  if (selection.kind === "invalid") {
    return `the parts can no longer be ordered: ${selection.reason}`;
  }
  if (selection.kind === "none") {
    return "the folder has no game parts any more";
  }
  return (
    "the parts no longer begin with the game's chapters, now: " +
    selection.parts.join(", ")
  );
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

  /**
   * Whether a rejected folder deserves another look: its parts can be ordered
   * now, or fail for another reason than the recorded one.
   */
  function rejectionChanged(folder: FolderSnapshot, detail: string | null) {
    const selection = selectGameParts(folder.files.map((file) => file.name));
    return (
      selection.kind === "parts" ||
      (selection.kind === "invalid" && selection.reason !== detail)
    );
  }

  /**
   * Keep an imported game in step with its folder: append the parts that
   * arrived after the import while the coach has not accepted the game yet,
   * and record any other change instead of applying it.
   */
  async function followImported(
    folder: FolderSnapshot,
    detail: string | null,
    game: ImportedGame,
    now: Date,
    summary: ImportPassSummary,
  ): Promise<void> {
    const selection = selectGameParts(folder.files.map((file) => file.name));
    const current =
      selection.kind === "parts"
        ? selection.parts.map((part) => `${folder.name}/${part}`)
        : null;

    if (current && sameList(current, game.filePaths)) {
      tracker.forget(folder.name);
      if (detail !== null) {
        await deps.repository.recordDetail(folder.name, null);
      }
      return;
    }
    if (!tracker.observe(folder.name, folder.fingerprint, now)) {
      summary.waiting.push(folder.name);
      return;
    }

    const lateParts =
      selection.kind === "parts" &&
      current &&
      startsWith(current, game.filePaths)
        ? selection.parts.slice(game.filePaths.length)
        : null;

    if (lateParts && game.underReview) {
      const probed = await probeParts(folder, lateParts);
      if (!probed) {
        summary.waiting.push(folder.name);
        return;
      }
      const appended = await deps.repository.appendSources({
        folderPath: folder.name,
        gameId: game.id,
        knownFilePaths: game.filePaths,
        sources: probed.sources,
      });
      // Not appended: the coach accepted or changed the game in the meantime,
      // and the next pass sees the new state.
      if (!appended) return;
      tracker.forget(folder.name);
      summary.appended.push(folder.name);
      deps.log.info(
        `appended ${lateParts.length} late part(s) of "${folder.name}" to ` +
          `game ${game.id}: ${lateParts.join(", ")}`,
      );
      return;
    }

    const change = describeChange(selection, lateParts);
    if (change === detail) return;
    await deps.repository.recordDetail(folder.name, change);
    summary.flagged.push(folder.name);
    deps.log.warn(
      `"${folder.name}" changed after its import, game ${game.id} left ` +
        `as it is: ${change}`,
    );
  }

  async function runPass(): Promise<ImportPassSummary> {
    const summary: ImportPassSummary = {
      skipped: [],
      imported: [],
      rejected: [],
      appended: [],
      flagged: [],
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
      const record = recorded.get(folder.name);
      if (record?.status === "imported" && record.game) {
        await followImported(folder, record.detail, record.game, now, summary);
        continue;
      }
      const recheck =
        record?.status === "rejected" &&
        rejectionChanged(folder, record.detail);
      if (record && !recheck) {
        tracker.forget(folder.name);
        continue;
      }
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
