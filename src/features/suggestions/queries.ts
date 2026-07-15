/**
 * Database access for whistle-suggestion review (P1-5). Thin wrappers over the
 * `whistle_candidates` table so the route handlers stay readable and the SQL
 * lives in one place.
 *
 * A candidate is a double-whistle timestamp reported by hockey-video-pipeline.
 * The review flow never auto-commits: a coach confirms (the candidate becomes a
 * `goal` tag with `source = suggestion`) or rejects it (the candidate is only
 * marked). Both transition happen only from `pending`, so a candidate is
 * reviewed exactly once and a confirm can never mint two tags for the same
 * whistle.
 */
import "server-only";
import { and, asc, eq } from "drizzle-orm";

import { goalTagFromCandidate } from "./review";
import type { ReviewDecision } from "./validation";

import { db } from "@/lib/db";
import { tags, whistleCandidates } from "@/lib/db/schema";

/** A double-whistle candidate row for a game, in game-time order. */
export interface WhistleCandidateRow {
  id: string;
  gameId: string;
  /** Global game-time offset of the candidate whistle, in seconds. */
  atS: number;
  status: "pending" | "confirmed" | "rejected";
  createdAt: Date;
}

/** The goal tag minted when a candidate is confirmed. */
export interface CommittedTag {
  id: string;
  gameId: string;
  type: string;
  startS: number;
  endS: number | null;
  source: "manual" | "suggestion";
  createdAt: Date;
}

/**
 * The result of reviewing a candidate: it did not exist, it was already
 * reviewed (a no-op conflict), or the review applied - carrying the updated
 * candidate and, on a confirm, the goal tag it committed.
 */
export type ReviewOutcome =
  | { status: "not_found" }
  | { status: "conflict"; candidate: WhistleCandidateRow }
  | {
      status: "reviewed";
      candidate: WhistleCandidateRow;
      tag: CommittedTag | null;
    };

const candidateCols = {
  id: whistleCandidates.id,
  gameId: whistleCandidates.gameId,
  atS: whistleCandidates.atS,
  status: whistleCandidates.status,
  createdAt: whistleCandidates.createdAt,
} as const;

const tagCols = {
  id: tags.id,
  gameId: tags.gameId,
  type: tags.type,
  startS: tags.startS,
  endS: tags.endS,
  source: tags.source,
  createdAt: tags.createdAt,
} as const;

/** List a game's whistle candidates in game-time order (empty when none). */
export async function listWhistleCandidates(
  gameId: string,
): Promise<WhistleCandidateRow[]> {
  return db
    .select(candidateCols)
    .from(whistleCandidates)
    .where(eq(whistleCandidates.gameId, gameId))
    .orderBy(asc(whistleCandidates.atS));
}

/**
 * Apply a coach's verdict to a pending candidate in one transaction, stamping
 * the confirming coach as the goal tag's author. Returns `not_found` for an
 * unknown id and `conflict` when the candidate is no longer pending (already
 * reviewed, or lost to a concurrent review). The `status = pending` guard in the
 * update is what makes confirm idempotent: two racing confirms cannot both flip
 * the row, so only one goal tag is ever minted.
 */
export async function reviewWhistleCandidate(
  id: string,
  decision: ReviewDecision,
  coachId: string,
): Promise<ReviewOutcome> {
  return db.transaction(async (tx) => {
    const [candidate] = await tx
      .select(candidateCols)
      .from(whistleCandidates)
      .where(eq(whistleCandidates.id, id))
      .limit(1);
    if (!candidate) return { status: "not_found" };
    if (candidate.status !== "pending") {
      return { status: "conflict", candidate };
    }

    const nextStatus = decision === "confirm" ? "confirmed" : "rejected";
    const [updated] = await tx
      .update(whistleCandidates)
      .set({ status: nextStatus })
      .where(
        and(
          eq(whistleCandidates.id, id),
          eq(whistleCandidates.status, "pending"),
        ),
      )
      .returning(candidateCols);
    if (!updated) return { status: "conflict", candidate };

    let tag: CommittedTag | null = null;
    if (decision === "confirm") {
      const window = goalTagFromCandidate(candidate.atS);
      const [row] = await tx
        .insert(tags)
        .values({
          gameId: candidate.gameId,
          type: window.type,
          startS: window.startS,
          endS: window.endS,
          authorId: coachId,
          source: "suggestion",
        })
        .returning(tagCols);
      tag = row;
    }

    return { status: "reviewed", candidate: updated, tag };
  });
}
