/**
 * `PATCH /api/suggestions/[id]` - review one double-whistle candidate (P1-5).
 * Coach-only: only a coach confirms or rejects a candidate, so the client never
 * touches the DB directly (see the stack notes). Confirming commits the
 * candidate to a `goal` tag (`source = suggestion`) stamped with the reviewing
 * coach; rejecting only marks it. Candidates are never auto-committed - spectator
 * whistles cause false positives (PRD 5.3) - so a decision is always required.
 * A missing candidate maps to 404; an already-reviewed one maps to 409.
 */
import { NextResponse } from "next/server";

import { getCurrentCoach } from "@/features/access";
import { reviewWhistleCandidate } from "@/features/suggestions/queries";
import {
  isValidCandidateId,
  parseReviewInput,
} from "@/features/suggestions/validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(
  request: Request,
  { params }: Context,
): Promise<Response> {
  const coach = await getCurrentCoach();
  if (!coach) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidCandidateId(id)) {
    return NextResponse.json(
      { error: "id must be a valid candidate id" },
      { status: 400 },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = parseReviewInput(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const outcome = await reviewWhistleCandidate(
    id,
    parsed.value.decision,
    coach.id,
  );
  if (outcome.status === "not_found") {
    return NextResponse.json({ error: "candidate not found" }, { status: 404 });
  }
  if (outcome.status === "conflict") {
    return NextResponse.json(
      { error: "candidate already reviewed", candidate: outcome.candidate },
      { status: 409 },
    );
  }
  return NextResponse.json({
    candidate: outcome.candidate,
    tag: outcome.tag,
  });
}
