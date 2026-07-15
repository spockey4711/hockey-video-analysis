/**
 * Server-side read for the instant jump-marker mode (P1-1): a game's tags as
 * jump markers, in timeline order.
 *
 * Markers come straight from the `tags` table - every captured moment, manual or
 * confirmed suggestion - so the coach can jump between them the instant a game is
 * loaded, with no dependency on the clip-cutting pipeline (PRD Phase 1 s11
 * Option A). The schema is fixed since P0-1; this only adds a query.
 */
import "server-only";
import { asc, eq } from "drizzle-orm";

import type { JumpMarker } from "./navigation";

import { db } from "@/lib/db";
import { tags } from "@/lib/db/schema";

// A game id is a UUID; reject anything else before it reaches Postgres, which
// would otherwise error on a malformed uuid cast rather than simply not match.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * List a game's tags as jump markers, ordered by their start on the game
 * timeline (empty when the game has no tags yet, or the id is malformed). Only
 * the fields jump navigation needs are selected - id, type and start offset.
 */
export async function listJumpMarkers(gameId: string): Promise<JumpMarker[]> {
  if (!UUID_PATTERN.test(gameId)) return [];

  return db
    .select({
      id: tags.id,
      type: tags.type,
      startS: tags.startS,
    })
    .from(tags)
    .where(eq(tags.gameId, gameId))
    .orderBy(asc(tags.startS));
}
