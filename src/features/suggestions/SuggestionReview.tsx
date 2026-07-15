"use client";

/**
 * Whistle-suggestion review panel (P1-5, PRD 5.3). A future watch-page mount
 * places this in the player's sidebar slot: the coach sees each double-whistle
 * candidate as a goal suggestion, jumps to the moment to check it, and confirms
 * it into a goal tag or rejects it. Nothing is auto-committed - spectator
 * whistles cause false positives - so every candidate waits on a coach decision.
 * Reviews go through `PATCH /api/suggestions/[id]`; live data goes through the
 * route handler, never a direct DB call from the client (see the stack notes).
 */
import { useState } from "react";

import { suggestionsContent } from "./content";
import type { ReviewDecision } from "./validation";

import { Card } from "@/components/core/Card";
import { PanelHeader } from "@/components/core/PanelHeader";
import { Button } from "@/components/forms/Button";
import { formatGameClock, usePlayerController } from "@/features/player";

/** A candidate as the panel tracks it (the review status is updated in place). */
export interface ReviewCandidate {
  id: string;
  atS: number;
  status: "pending" | "confirmed" | "rejected";
}

export interface SuggestionReviewProps {
  /** Candidates already loaded for this game (empty when none reported). */
  initialCandidates: readonly ReviewCandidate[];
}

type RowState =
  { kind: "idle" } | { kind: "reviewing" } | { kind: "error"; message: string };

export function SuggestionReview({ initialCandidates }: SuggestionReviewProps) {
  const controller = usePlayerController();
  const [candidates, setCandidates] = useState<ReviewCandidate[]>(() => [
    ...initialCandidates,
  ]);
  const [rowState, setRowState] = useState<Record<string, RowState>>({});

  function setState(id: string, state: RowState): void {
    setRowState((rows) => ({ ...rows, [id]: state }));
  }

  async function review(id: string, decision: ReviewDecision): Promise<void> {
    setState(id, { kind: "reviewing" });
    try {
      const response = await fetch(`/api/suggestions/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!response.ok) {
        const message =
          response.status === 409
            ? suggestionsContent.errors.conflict
            : suggestionsContent.errors.review;
        setState(id, { kind: "error", message });
        return;
      }
      const nextStatus = decision === "confirm" ? "confirmed" : "rejected";
      setCandidates((rows) =>
        rows.map((row) =>
          row.id === id ? { ...row, status: nextStatus } : row,
        ),
      );
      setState(id, { kind: "idle" });
    } catch {
      setState(id, {
        kind: "error",
        message: suggestionsContent.errors.review,
      });
    }
  }

  return (
    <Card
      as="section"
      panel
      aria-label={suggestionsContent.panelTitle}
      className="flex flex-col gap-[var(--space-3)] p-[var(--space-4)]"
    >
      <PanelHeader
        title={suggestionsContent.panelTitle}
        hint={suggestionsContent.panelHint}
      />

      {candidates.length === 0 ? (
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {suggestionsContent.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-[var(--space-2)]">
          {candidates.map((candidate) => {
            const state = rowState[candidate.id] ?? { kind: "idle" };
            const busy = state.kind === "reviewing";
            return (
              <li
                key={candidate.id}
                className="flex flex-col gap-[var(--space-1)] text-[length:var(--fs-body-sm)] text-[color:var(--text-primary)]"
              >
                <div className="flex items-center gap-[var(--space-2)]">
                  <span className="w-[7ch] shrink-0 font-[family-name:var(--font-mono)] text-[color:var(--text-secondary)] tabular-nums">
                    {formatGameClock(candidate.atS)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => controller.seekTo(candidate.atS)}
                  >
                    {suggestionsContent.jump}
                  </Button>
                  {candidate.status === "pending" ? (
                    <>
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => void review(candidate.id, "confirm")}
                      >
                        {busy
                          ? suggestionsContent.reviewing
                          : suggestionsContent.confirm}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void review(candidate.id, "reject")}
                      >
                        {suggestionsContent.reject}
                      </Button>
                    </>
                  ) : (
                    <span
                      className={
                        candidate.status === "confirmed"
                          ? "[font-weight:var(--fw-semibold)] text-[color:var(--success)]"
                          : "text-[color:var(--text-muted)]"
                      }
                    >
                      {candidate.status === "confirmed"
                        ? suggestionsContent.confirmed
                        : suggestionsContent.rejected}
                    </span>
                  )}
                </div>
                {state.kind === "error" && (
                  <p
                    aria-live="polite"
                    role="status"
                    className="text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
                  >
                    {state.message}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
