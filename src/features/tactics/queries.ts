/**
 * Server-side reads and writes for the coach-only tactics board. A scene is a
 * name plus one versioned JSON document (ADR 0010); every document read back
 * passes `parseScene`, so a row that no longer parses is treated as missing
 * rather than handed to the board.
 */
import "server-only";
import { asc, desc, eq } from "drizzle-orm";

import { parseScene, type TacticsScene } from "./scene";

import { db } from "@/lib/db";
import { players, tacticsScenes } from "@/lib/db/schema";

/** One scene as listed on the tactics page. */
export interface SceneListItem {
  readonly id: string;
  readonly name: string;
  readonly updatedAt: Date;
}

/** A scene loaded into the editor. */
export interface SceneForEdit {
  readonly id: string;
  readonly name: string;
  readonly scene: TacticsScene;
}

/** A roster player a token can stand for. */
export interface BoardRosterPlayer {
  readonly id: string;
  readonly name: string;
  readonly jerseyNumber: number | null;
}

/** Every scene, most recently changed first. */
export async function listScenes(): Promise<SceneListItem[]> {
  return db
    .select({
      id: tacticsScenes.id,
      name: tacticsScenes.name,
      updatedAt: tacticsScenes.updatedAt,
    })
    .from(tacticsScenes)
    .orderBy(desc(tacticsScenes.updatedAt));
}

/** One scene for the editor, or `null` when none matches or it does not parse. */
export async function getScene(id: string): Promise<SceneForEdit | null> {
  const [row] = await db
    .select({
      id: tacticsScenes.id,
      name: tacticsScenes.name,
      scene: tacticsScenes.scene,
    })
    .from(tacticsScenes)
    .where(eq(tacticsScenes.id, id))
    .limit(1);
  if (!row) return null;
  const scene = parseScene(row.scene);
  return scene ? { id: row.id, name: row.name, scene } : null;
}

/** Store a new scene and return its id. */
export async function createScene(input: {
  name: string;
  scene: TacticsScene;
  createdBy: string;
}): Promise<{ id: string }> {
  const [row] = await db
    .insert(tacticsScenes)
    .values(input)
    .returning({ id: tacticsScenes.id });
  if (!row) throw new Error("Scene insert returned no row");
  return row;
}

/** Save a scene's name and document; `false` when the scene does not exist. */
export async function saveScene(
  id: string,
  input: { name: string; scene: TacticsScene },
): Promise<boolean> {
  const rows = await db
    .update(tacticsScenes)
    .set(input)
    .where(eq(tacticsScenes.id, id))
    .returning({ id: tacticsScenes.id });
  return rows.length > 0;
}

/** Delete a scene; `false` when it does not exist. */
export async function deleteScene(id: string): Promise<boolean> {
  const rows = await db
    .delete(tacticsScenes)
    .where(eq(tacticsScenes.id, id))
    .returning({ id: tacticsScenes.id });
  return rows.length > 0;
}

/**
 * The roster for linking tokens, numbered players first by number (Postgres
 * sorts nulls last), then by name. Only the fields a token needs; never a
 * player's share token.
 */
export async function listBoardRoster(): Promise<BoardRosterPlayer[]> {
  return db
    .select({
      id: players.id,
      name: players.name,
      jerseyNumber: players.jerseyNumber,
    })
    .from(players)
    .orderBy(asc(players.jerseyNumber), asc(players.name));
}
