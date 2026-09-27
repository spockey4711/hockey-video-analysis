/**
 * The Mac app's game writes (ADR 0013, Mac plan S4): registering a game from
 * the Mac's library and changing a game's own fields with a base version.
 * Accepting and discarding a game under review reuse the web review's queries
 * in `@/features/games/queries`, so the review's rules exist once.
 *
 * A registered game is a `mac` game: the Mac holds its originals and cuts its
 * clips, so the VPS clip worker and proxy encoder leave it alone. Its
 * `ingest_folders` row, written in the same transaction, carries the folder
 * name and the chapters' names and sizes, so the Drive importer recognises
 * the folder when the Mac's backup of it lands on Drive instead of importing
 * it a second time (S7 links it).
 */
import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";

import {
  GAME_FIELD_COLUMNS,
  selectGameFields,
  toGameFields,
  type GameFields,
} from "./queries";
import {
  gamePatchConflict,
  type GameFieldsPatch,
  type GameRegistration,
} from "./validation";

import { isUnnamedGame } from "@/features/games/format";
import { fingerprintFiles } from "@/features/ingest/scan";
import { db } from "@/lib/db";
import { gameSources, games, ingestFolders } from "@/lib/db/schema";

/** What registering a game did. */
export type RegisterOutcome =
  /** The game is new and stored. */
  | "created"
  /** A retry: the game is stored with exactly these chapters already. */
  | "exists"
  /** The id belongs to a game with other chapters. */
  | "id_taken"
  /** The folder is recorded for another game, or seen on Drive already. */
  | "folder_taken";

/** Thrown inside the registration's transaction to roll the game back. */
class FolderTaken extends Error {}

/**
 * The `ingest_folders` parts record of a registration: one
 * `<file name>\t<size>` line per chapter, as the Drive scan records a folder.
 */
export function registrationParts(registration: GameRegistration): string {
  return fingerprintFiles(
    registration.chapters.map((chapter) => ({
      name: chapter.filePath.slice(registration.folderPath.length + 1),
      sizeBytes: chapter.sizeBytes,
    })),
  );
}

/**
 * Register a Mac game under review with its chapters and folder row, all in
 * one transaction. The client-made id makes it idempotent: a retry of the
 * same registration finds the game stored and changes nothing.
 */
export async function registerMacGame(
  registration: GameRegistration,
  coachId: string,
): Promise<RegisterOutcome> {
  const parts = registrationParts(registration);
  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(games)
        .values({
          id: registration.id,
          title: "",
          opponent: null,
          playedOn: registration.playedOn,
          createdBy: coachId,
          mediaHome: "mac",
        })
        .onConflictDoNothing({ target: games.id })
        .returning({ id: games.id });
      if (!created) {
        return (await isSameRegistration(tx, registration, parts))
          ? "exists"
          : "id_taken";
      }

      await tx.insert(gameSources).values(
        registration.chapters.map((chapter, index) => ({
          gameId: registration.id,
          orderIndex: index,
          filePath: chapter.filePath,
          durationS: chapter.durationS,
          frameRate: chapter.frameRate,
        })),
      );

      // Like the importer, only a `rejected` row may be taken over: any other
      // row means the folder is a game already, or was on Drive before.
      const [folder] = await tx
        .insert(ingestFolders)
        .values({
          folderPath: registration.folderPath,
          status: "imported",
          gameId: registration.id,
          parts,
        })
        .onConflictDoUpdate({
          target: ingestFolders.folderPath,
          set: {
            status: "imported",
            gameId: registration.id,
            detail: null,
            parts,
            updatedAt: sql`now()`,
          },
          setWhere: eq(ingestFolders.status, "rejected"),
        })
        .returning({ id: ingestFolders.id });
      if (!folder) throw new FolderTaken();
      return "created";
    });
  } catch (error) {
    if (error instanceof FolderTaken) return "folder_taken";
    throw error;
  }
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Whether the stored game with the registration's id is that registration. */
async function isSameRegistration(
  tx: Transaction,
  registration: GameRegistration,
  parts: string,
): Promise<boolean> {
  const [game] = await tx
    .select({ mediaHome: games.mediaHome })
    .from(games)
    .where(eq(games.id, registration.id))
    .limit(1);
  if (game?.mediaHome !== "mac") return false;

  const [folder] = await tx
    .select({ parts: ingestFolders.parts })
    .from(ingestFolders)
    .where(
      and(
        eq(ingestFolders.gameId, registration.id),
        eq(ingestFolders.folderPath, registration.folderPath),
      ),
    )
    .limit(1);
  if (folder?.parts !== parts) return false;

  const chapters = await tx
    .select({
      filePath: gameSources.filePath,
      durationS: gameSources.durationS,
    })
    .from(gameSources)
    .where(eq(gameSources.gameId, registration.id))
    .orderBy(asc(gameSources.orderIndex));
  return (
    chapters.length === registration.chapters.length &&
    chapters.every(
      (chapter, index) =>
        chapter.filePath === registration.chapters[index].filePath &&
        chapter.durationS === registration.chapters[index].durationS,
    )
  );
}

/** What a change to a game's fields did. */
export type GamePatchOutcome =
  | { kind: "updated"; game: GameFields }
  | { kind: "not_found" }
  /** The game moved past the base version; `game` is how it is now. */
  | { kind: "conflict"; game: GameFields }
  /** The patch does not fit the game's review state. */
  | { kind: "invalid"; error: string };

/**
 * Change a game's title, opponent or date, but only while it is still at
 * `baseVersion`. The row is locked first, so the check and the write cannot
 * be split by another write. A change that sets every field to its current
 * value keeps the version (the trigger sees no change).
 */
export function updateGameFields(
  gameId: string,
  patch: GameFieldsPatch,
  baseVersion: number,
): Promise<GamePatchOutcome> {
  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ id: games.id })
      .from(games)
      .where(and(eq(games.id, gameId), eq(games.awaitingProxies, false)))
      .for("update");
    if (!locked) return { kind: "not_found" };
    const current = await selectGameFields(tx, gameId);
    if (!current) return { kind: "not_found" };
    if (current.version !== baseVersion) {
      return { kind: "conflict", game: current };
    }

    const error = gamePatchConflict(patch, isUnnamedGame(current.title));
    if (error) return { kind: "invalid", error };

    const [updated] = await tx
      .update(games)
      .set(patch)
      .where(eq(games.id, gameId))
      .returning(GAME_FIELD_COLUMNS);
    return { kind: "updated", game: toGameFields(updated) };
  });
}
