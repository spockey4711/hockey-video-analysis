/**
 * Server-side reads and writes for the coach-only tactics board. A scene is a
 * name plus one versioned JSON document (ADR 0010); every document read back
 * passes `parseScene`, so a row that no longer parses is treated as missing
 * rather than handed to the board.
 */
import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";

import type { SceneCategory } from "./library";
import type { PitchView } from "./pitch";
import { parseScene, type TacticsScene } from "./scene";
import { parseSceneView } from "./validation";

import { db } from "@/lib/db";
import { players, tacticsScenes } from "@/lib/db/schema";

/** One scene as listed on the tactics page, with what its filter looks at. */
export interface SceneListItem {
  readonly id: string;
  readonly name: string;
  readonly category: SceneCategory;
  readonly tags: readonly string[];
  readonly view: PitchView;
  readonly updatedAt: Date;
}

/**
 * A scene loaded into the editor, with the coach's private coaching points
 * (`null` for none), which live beside the document and never go into it.
 */
export interface SceneForEdit {
  readonly id: string;
  readonly name: string;
  readonly category: SceneCategory;
  readonly tags: readonly string[];
  readonly scene: TacticsScene;
  readonly coachingNotes: string | null;
}

/** A scene's place in the set-play library, kept beside its document. */
export interface SceneGrouping {
  readonly category: SceneCategory;
  readonly tags: readonly string[];
}

/** A roster player a token can stand for. */
export interface BoardRosterPlayer {
  readonly id: string;
  readonly name: string;
  readonly jerseyNumber: number | null;
}

/**
 * Every scene, most recently changed first. The view is read straight from
 * the document rather than parsing all of it; a version 3 short corner
 * ("corner-left"/"corner-right") reads as the one short corner, like
 * `parseScene` reads it, and anything else unknown as the full pitch.
 */
export async function listScenes(): Promise<SceneListItem[]> {
  const rows = await db
    .select({
      id: tacticsScenes.id,
      name: tacticsScenes.name,
      category: tacticsScenes.category,
      tags: tacticsScenes.tags,
      view: sql<string | null>`${tacticsScenes.scene}->>'view'`,
      updatedAt: tacticsScenes.updatedAt,
    })
    .from(tacticsScenes)
    .orderBy(desc(tacticsScenes.updatedAt));
  return rows.map((row) => ({
    ...row,
    view: row.view?.startsWith("corner")
      ? "corner"
      : (parseSceneView(row.view) ?? "full"),
  }));
}

/** One scene for the editor, or `null` when none matches or it does not parse. */
export async function getScene(id: string): Promise<SceneForEdit | null> {
  const [row] = await db
    .select({
      id: tacticsScenes.id,
      name: tacticsScenes.name,
      category: tacticsScenes.category,
      tags: tacticsScenes.tags,
      scene: tacticsScenes.scene,
      coachingNotes: tacticsScenes.coachingNotes,
    })
    .from(tacticsScenes)
    .where(eq(tacticsScenes.id, id))
    .limit(1);
  if (!row) return null;
  const scene = parseScene(row.scene);
  return scene ? { ...row, scene } : null;
}

/** Store a new scene and return its id; without a grouping it is "other". */
export async function createScene(
  input: {
    name: string;
    scene: TacticsScene;
    createdBy: string;
    coachingNotes?: string | null;
  } & Partial<SceneGrouping>,
): Promise<{ id: string }> {
  const [row] = await db
    .insert(tacticsScenes)
    .values({ ...input, tags: input.tags && [...input.tags] })
    .returning({ id: tacticsScenes.id });
  if (!row) throw new Error("Scene insert returned no row");
  return row;
}

/**
 * How a save ended: stored, or refused because the scene does not exist (or
 * no longer parses, like {@link getScene}) or because the document would
 * change its view, which is fixed when the scene is created.
 */
export type SaveSceneResult = "saved" | "not-found" | "view-locked";

/**
 * Save a scene's document, and its grouping and coaching points when they
 * are sent; the name changes only through {@link renameScene}. The stored row
 * is locked while its view is compared, so no other save slips in between the
 * check and the write.
 */
export async function saveScene(
  id: string,
  input: {
    scene: TacticsScene;
    coachingNotes?: string | null;
  } & Partial<SceneGrouping>,
): Promise<SaveSceneResult> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ scene: tacticsScenes.scene })
      .from(tacticsScenes)
      .where(eq(tacticsScenes.id, id))
      .for("update");
    const stored = row ? parseScene(row.scene) : null;
    if (!stored) return "not-found";
    if (stored.view !== input.scene.view) return "view-locked";
    await tx
      .update(tacticsScenes)
      .set({ ...input, tags: input.tags && [...input.tags] })
      .where(eq(tacticsScenes.id, id));
    return "saved";
  });
}

/** Rename a scene, leaving its document alone; `false` when it does not exist. */
export async function renameScene(id: string, name: string): Promise<boolean> {
  const rows = await db
    .update(tacticsScenes)
    .set({ name })
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
