"use client";

import { useMemo } from "react";

import type { AudienceBoard as AudienceBoardData } from "./audience-protocol";

import { BoardCanvas } from "@/features/tactics/BoardCanvas";
import { CornerLegend } from "@/features/tactics/LineLegend";
import { initialBoardState } from "@/features/tactics/board-state";
import { useOrientation } from "@/features/tactics/use-orientation";

/** The audience window never edits the board. */
function ignore(): void {}

export interface AudienceBoardProps {
  readonly board: AudienceBoardData;
}

/**
 * The tactics board on the audience window: the presenter's pitch as it
 * stands or moves, drawn with the board's own canvas but inert - no tools,
 * no selection, nothing to click - filling the projector, with the legend
 * of its play lines in a corner.
 */
export function AudienceBoard({ board }: AudienceBoardProps) {
  const orientation = useOrientation();
  const state = useMemo(
    () => ({
      ...initialBoardState(board.scene),
      step: board.step,
      playback: board.playback,
      draft: board.draft,
    }),
    [board],
  );

  return (
    <div
      inert
      className="absolute inset-0 z-20 flex bg-[var(--bg-app)] p-[var(--space-4)]"
    >
      <CornerLegend lines={board.scene.lines} />
      <div className="[container-type:size] flex min-h-0 flex-1 items-center">
        <BoardCanvas
          state={state}
          dispatch={ignore}
          orientation={orientation}
          roster={[]}
          fit="container"
        />
      </div>
    </div>
  );
}
