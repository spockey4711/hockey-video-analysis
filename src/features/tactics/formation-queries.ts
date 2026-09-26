/**
 * Server-side reads and writes for the coach's tactics formations. Like a
 * scene, every formation read back passes `parseFormation`, so a row that no
 * longer parses is treated as missing rather than handed to the board.
 */
import "server-only";
import { desc, eq } from "drizzle-orm";

import {
  parseFormation,
  teamCounts,
  type FormationKind,
  type TacticsFormation,
} from "./formation";
import type { PitchView } from "./pitch";
import type { Team } from "./scene";

import { db } from "@/lib/db";
import { tacticsFormations } from "@/lib/db/schema";

/** One formation as listed and offered for a new scene. */
export interface FormationListItem {
  readonly id: string;
  readonly name: string;
  readonly kind: FormationKind;
  readonly view: PitchView;
  readonly players: Record<Team, number>;
}

/** A formation loaded into its editor or copied into a new scene. */
export interface FormationForEdit {
  readonly id: string;
  readonly name: string;
  readonly kind: FormationKind;
  readonly formation: TacticsFormation;
}

/** Every formation that parses, most recently changed first. */
export async function listFormations(): Promise<FormationListItem[]> {
  const rows = await db
    .select({
      id: tacticsFormations.id,
      name: tacticsFormations.name,
      kind: tacticsFormations.kind,
      formation: tacticsFormations.formation,
    })
    .from(tacticsFormations)
    .orderBy(desc(tacticsFormations.updatedAt));
  return rows.flatMap((row) => {
    const formation = parseFormation(row.formation);
    if (!formation) return [];
    return [
      {
        id: row.id,
        name: row.name,
        kind: row.kind,
        view: formation.view,
        players: teamCounts(formation.tokens),
      },
    ];
  });
}

/** One formation, or `null` when none matches or it does not parse. */
export async function getFormation(
  id: string,
): Promise<FormationForEdit | null> {
  const [row] = await db
    .select({
      id: tacticsFormations.id,
      name: tacticsFormations.name,
      kind: tacticsFormations.kind,
      formation: tacticsFormations.formation,
    })
    .from(tacticsFormations)
    .where(eq(tacticsFormations.id, id))
    .limit(1);
  if (!row) return null;
  const formation = parseFormation(row.formation);
  return formation ? { ...row, formation } : null;
}

/** Store a new formation and return its id. */
export async function createFormation(input: {
  name: string;
  kind: FormationKind;
  formation: TacticsFormation;
  createdBy: string;
}): Promise<{ id: string }> {
  const [row] = await db
    .insert(tacticsFormations)
    .values(input)
    .returning({ id: tacticsFormations.id });
  if (!row) throw new Error("Formation insert returned no row");
  return row;
}

/** Save a formation's name, kind and document; `false` when it does not exist. */
export async function saveFormation(
  id: string,
  input: { name: string; kind: FormationKind; formation: TacticsFormation },
): Promise<boolean> {
  const rows = await db
    .update(tacticsFormations)
    .set(input)
    .where(eq(tacticsFormations.id, id))
    .returning({ id: tacticsFormations.id });
  return rows.length > 0;
}

/** Delete a formation; `false` when it does not exist. */
export async function deleteFormation(id: string): Promise<boolean> {
  const rows = await db
    .delete(tacticsFormations)
    .where(eq(tacticsFormations.id, id))
    .returning({ id: tacticsFormations.id });
  return rows.length > 0;
}
