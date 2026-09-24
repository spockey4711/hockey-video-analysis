/**
 * The database side of the Drive importer: the `ingest_folders` record and the
 * games it registers, plus the chapter list the proxy encoder works through.
 *
 * This module is the only part of the importer that talks to Postgres; the
 * import pass and the proxy encoder see it through {@link IngestRepository}
 * and {@link ProxySourceList} and are unit-tested against fakes.
 */
import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";

import type {
  ImportedGame,
  IngestRepository,
  RecordedFolder,
} from "./importer";
import type { ProxySource, ProxySourceList } from "./proxy";

import type { WorkerDatabase } from "@/features/clips/cut";
import { isUnnamedGame } from "@/features/games/format";
import { gameSources, games, ingestFolders } from "@/lib/db/schema";

/** Thrown inside `registerGame`'s transaction to roll the game back. */
class FolderAlreadyRecorded extends Error {}

export function createIngestRepository(
  db: WorkerDatabase,
): IngestRepository & ProxySourceList {
  return {
    // One row per folder and chapter of its game (one row for a folder without
    // a game), folded into one entry per folder.
    async recordedFolders() {
      const rows = await db
        .select({
          folderPath: ingestFolders.folderPath,
          status: ingestFolders.status,
          detail: ingestFolders.detail,
          parts: ingestFolders.parts,
          gameId: games.id,
          title: games.title,
          filePath: gameSources.filePath,
        })
        .from(ingestFolders)
        .leftJoin(games, eq(ingestFolders.gameId, games.id))
        .leftJoin(gameSources, eq(gameSources.gameId, games.id))
        .orderBy(asc(ingestFolders.folderPath), asc(gameSources.orderIndex));

      const folders = new Map<string, RecordedFolder>();
      const filePaths = new Map<string, string[]>();
      for (const row of rows) {
        if (!folders.has(row.folderPath)) {
          let folder: RecordedFolder;
          if (row.status === "imported") {
            let game: ImportedGame | null = null;
            if (row.gameId !== null && row.title !== null) {
              const paths: string[] = [];
              filePaths.set(row.folderPath, paths);
              game = {
                id: row.gameId,
                underReview: isUnnamedGame(row.title),
                filePaths: paths,
              };
            }
            folder = {
              status: "imported",
              detail: row.detail,
              parts: row.parts,
              game,
            };
          } else if (row.status === "rejected") {
            folder = { status: "rejected", detail: row.detail };
          } else {
            folder = { status: "skipped", parts: row.parts };
          }
          folders.set(row.folderPath, folder);
        }
        if (row.filePath !== null) {
          filePaths.get(row.folderPath)?.push(row.filePath);
        }
      }
      return folders;
    },

    async recordSkipped(folders, detail) {
      if (folders.length === 0) return;
      await db
        .insert(ingestFolders)
        .values(
          folders.map(({ folderPath, parts }) => ({
            folderPath,
            status: "skipped" as const,
            detail,
            parts,
          })),
        )
        .onConflictDoNothing({ target: ingestFolders.folderPath });
    },

    async recordParts(folderPath, parts) {
      await db
        .update(ingestFolders)
        .set({ parts })
        .where(
          and(
            eq(ingestFolders.folderPath, folderPath),
            ne(ingestFolders.status, "rejected"),
            isNull(ingestFolders.parts),
          ),
        );
    },

    async recordRejected(folderPath, reason) {
      await db
        .insert(ingestFolders)
        .values({ folderPath, status: "rejected", detail: reason })
        .onConflictDoUpdate({
          target: ingestFolders.folderPath,
          set: { detail: reason, updatedAt: sql`now()` },
          setWhere: eq(ingestFolders.status, "rejected"),
        });
    },

    // The folder row goes in with the game. Only a `rejected` row may be taken
    // over; if any other row exists (another importer got there first), the
    // game is rolled back, so a folder can never become two games.
    async registerGame({ folderPath, parts, playedOn, sources }) {
      try {
        return await db.transaction(async (tx) => {
          const [game] = await tx
            .insert(games)
            .values({ title: "", opponent: null, playedOn, createdBy: null })
            .returning({ id: games.id });

          await tx.insert(gameSources).values(
            sources.map((source, index) => ({
              gameId: game.id,
              orderIndex: index,
              filePath: source.filePath,
              durationS: source.durationS,
            })),
          );

          const [folder] = await tx
            .insert(ingestFolders)
            .values({ folderPath, status: "imported", gameId: game.id, parts })
            .onConflictDoUpdate({
              target: ingestFolders.folderPath,
              set: {
                status: "imported",
                gameId: game.id,
                detail: null,
                parts,
                updatedAt: sql`now()`,
              },
              setWhere: eq(ingestFolders.status, "rejected"),
            })
            .returning({ id: ingestFolders.id });
          if (!folder) throw new FolderAlreadyRecorded();

          return { gameId: game.id };
        });
      } catch (error) {
        if (error instanceof FolderAlreadyRecorded) return null;
        throw error;
      }
    },

    // The game row is locked first, so accepting the game in the review and
    // appending to it cannot interleave: whichever comes second sees the other.
    appendSources({ folderPath, gameId, knownFilePaths, sources }) {
      return db.transaction(async (tx) => {
        const [game] = await tx
          .select({ title: games.title })
          .from(games)
          .where(eq(games.id, gameId))
          .for("update");
        if (!game || !isUnnamedGame(game.title)) return false;

        const chapters = await tx
          .select({ filePath: gameSources.filePath })
          .from(gameSources)
          .where(eq(gameSources.gameId, gameId))
          .orderBy(asc(gameSources.orderIndex));
        const unchanged =
          chapters.length === knownFilePaths.length &&
          chapters.every(
            (chapter, index) => chapter.filePath === knownFilePaths[index],
          );
        if (!unchanged) return false;

        await tx.insert(gameSources).values(
          sources.map((source, index) => ({
            gameId,
            orderIndex: chapters.length + index,
            filePath: source.filePath,
            durationS: source.durationS,
          })),
        );
        await tx
          .update(ingestFolders)
          .set({ detail: null })
          .where(eq(ingestFolders.folderPath, folderPath));
        return true;
      });
    },

    async recordDetail(folderPath, detail) {
      await db
        .update(ingestFolders)
        .set({ detail })
        .where(
          and(
            eq(ingestFolders.folderPath, folderPath),
            eq(ingestFolders.status, "imported"),
          ),
        );
    },

    async listProxySources(): Promise<readonly ProxySource[]> {
      return db
        .select({
          filePath: gameSources.filePath,
          durationS: gameSources.durationS,
        })
        .from(gameSources)
        .innerJoin(games, eq(gameSources.gameId, games.id))
        .orderBy(desc(games.createdAt), asc(gameSources.orderIndex));
    },
  };
}
