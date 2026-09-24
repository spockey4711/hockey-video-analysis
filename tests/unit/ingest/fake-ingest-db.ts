/**
 * An in-memory stand-in for the importer's tables (`ingest_folders`, `games`,
 * `game_sources`) that keeps the rules of the real {@link IngestRepository}:
 * one row per folder, only a rejected row may become imported, late parts are
 * appended only while the game is under review and unchanged, and deleting a
 * game keeps its folder row with no game.
 */
import type {
  ImportedSource,
  IngestRepository,
  RecordedFolder,
} from "@/features/ingest";

export type FolderStatus = "skipped" | "imported" | "rejected";

export interface FakeFolderRow {
  status: FolderStatus;
  detail: string | null;
  gameId: string | null;
}

export interface FakeGame {
  title: string;
  playedOn: string | null;
  sources: ImportedSource[];
}

export interface RegisteredGame {
  folderPath: string;
  playedOn: string | null;
  sources: readonly ImportedSource[];
}

export function createFakeIngestDb(initial: Record<string, FolderStatus> = {}) {
  const rows = new Map<string, FakeFolderRow>(
    Object.entries(initial).map(([folderPath, status]) => [
      folderPath,
      { status, detail: null, gameId: null },
    ]),
  );
  const games = new Map<string, FakeGame>();
  /** Every successful `registerGame` call, in order. */
  const registered: RegisteredGame[] = [];

  const repository: IngestRepository = {
    async recordedFolders() {
      const folders = new Map<string, RecordedFolder>();
      for (const [folderPath, row] of rows) {
        if (row.status === "imported") {
          const game = row.gameId ? games.get(row.gameId) : undefined;
          folders.set(folderPath, {
            status: "imported",
            detail: row.detail,
            game:
              row.gameId && game
                ? {
                    id: row.gameId,
                    underReview: game.title.trim() === "",
                    filePaths: game.sources.map((source) => source.filePath),
                  }
                : null,
          });
        } else if (row.status === "rejected") {
          folders.set(folderPath, { status: "rejected", detail: row.detail });
        } else {
          folders.set(folderPath, { status: "skipped" });
        }
      }
      return folders;
    },

    async recordSkipped(folderPaths, detail) {
      for (const folderPath of folderPaths) {
        if (rows.has(folderPath)) continue;
        rows.set(folderPath, { status: "skipped", detail, gameId: null });
      }
    },

    async recordRejected(folderPath, reason) {
      const row = rows.get(folderPath);
      if (!row) {
        rows.set(folderPath, {
          status: "rejected",
          detail: reason,
          gameId: null,
        });
      } else if (row.status === "rejected") {
        row.detail = reason;
      }
    },

    async registerGame(input) {
      const row = rows.get(input.folderPath);
      if (row && row.status !== "rejected") {
        throw new Error(`"${input.folderPath}" is already recorded`);
      }
      const gameId = `game-${registered.length + 1}`;
      games.set(gameId, {
        title: "",
        playedOn: input.playedOn,
        sources: [...input.sources],
      });
      rows.set(input.folderPath, { status: "imported", detail: null, gameId });
      registered.push(input);
      return { gameId };
    },

    async appendSources({ folderPath, gameId, knownFilePaths, sources }) {
      const game = games.get(gameId);
      if (!game || game.title.trim() !== "") return false;
      const current = game.sources.map((source) => source.filePath);
      if (current.join("\n") !== knownFilePaths.join("\n")) return false;
      game.sources.push(...sources);
      const row = rows.get(folderPath);
      if (row) row.detail = null;
      return true;
    },

    async recordDetail(folderPath, detail) {
      const row = rows.get(folderPath);
      if (row?.status === "imported") row.detail = detail;
    },
  };

  return {
    repository,
    rows,
    games,
    registered,
    /** The coach accepts the game in the "Neu eingegangen" review. */
    accept(gameId: string, title: string): void {
      const game = games.get(gameId);
      if (!game) throw new Error(`no game ${gameId}`);
      game.title = title;
    },
    /** The chapter paths of a game, in play order. */
    chapters(gameId: string): string[] {
      return (games.get(gameId)?.sources ?? []).map(
        (source) => source.filePath,
      );
    },
    /** The `detail` of every row with `status`, by folder path. */
    details(status: FolderStatus): Record<string, string | null> {
      return Object.fromEntries(
        [...rows]
          .filter(([, row]) => row.status === status)
          .map(([folderPath, row]) => [folderPath, row.detail]),
      );
    },
  };
}
