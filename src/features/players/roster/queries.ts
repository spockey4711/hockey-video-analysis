/**
 * Server-side reads for the coach-only roster surface (P1-6 UI). Lists the team
 * players a coach manages so each row can mount the share-token rotation and
 * erasure forms. Only the fields the roster shows are selected; `share_token` is
 * a secret but this surface is behind the coach guard, and showing the link is
 * the point of the rotation control.
 */
import "server-only";
import { asc } from "drizzle-orm";

import { db } from "@/lib/db";
import { players } from "@/lib/db/schema";

/** One player as shown on the roster, with the secret its share link resolves by. */
export interface PlayerRosterItem {
  readonly id: string;
  readonly name: string;
  readonly jerseyNumber: number | null;
  /** The unguessable secret in the player's share link; rotating it revokes the link. */
  readonly shareToken: string;
}

/** Every player, ordered by name so the roster reads predictably (empty when none). */
export async function listPlayers(): Promise<PlayerRosterItem[]> {
  return db
    .select({
      id: players.id,
      name: players.name,
      jerseyNumber: players.jerseyNumber,
      shareToken: players.shareToken,
    })
    .from(players)
    .orderBy(asc(players.name));
}
