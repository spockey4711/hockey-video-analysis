/**
 * The database side of the Drive importer: the `ingest_folders` record and the
 * games it registers, plus the chapter list the proxy encoder works through.
 *
 * This module is the only part of the importer that talks to Postgres; the
 * import pass and the proxy encoder see it through {@link IngestRepository}
 * and {@link ProxySourceList} and are unit-tested against fakes.
 */
import { asc, desc, eq } from "drizzle-orm";

import type { IngestRepository } from "./importer";
import type { ProxySource, ProxySourceList } from "./proxy";

import type { WorkerDatabase } from "@/features/clips/cut";
import { gameSources, games, ingestFolders } from "@/lib/db/schema";

export function createIngestRepository(
  db: WorkerDatabase,
): IngestRepository & ProxySourceList {
  return {
    async recordedFolders() {
      const rows = await db
        .select({ folderPath: ingestFolders.folderPath })
        .from(ingestFolders);
      return new Set(rows.map((row) => row.folderPath));
    },

    async recordSkipped(folderPaths, detail) {
      if (folderPaths.length === 0) return;
      await db
        .insert(ingestFolders)
        .values(
          folderPaths.map((folderPath) => ({
            folderPath,
            status: "skipped" as const,
            detail,
          })),
        )
        .onConflictDoNothing({ target: ingestFolders.folderPath });
    },

    async recordRejected(folderPath, reason) {
      await db
        .insert(ingestFolders)
        .values({ folderPath, status: "rejected", detail: reason })
        .onConflictDoNothing({ target: ingestFolders.folderPath });
    },

    // The folder row goes in with the game: if another importer got there
    // first, the unique folder path fails the insert and rolls the game back,
    // so a folder can never become two games.
    registerGame({ folderPath, playedOn, sources }) {
      return db.transaction(async (tx) => {
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

        await tx
          .insert(ingestFolders)
          .values({ folderPath, status: "imported", gameId: game.id });

        return { gameId: game.id };
      });
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
