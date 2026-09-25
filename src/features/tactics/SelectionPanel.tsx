"use client";

/**
 * Edit what is selected on the board: a player's label and roster link, its
 * run in the step on show, or remove a player, the ball or a line.
 */
import type { Dispatch } from "react";

import { moveIn, type BoardAction, type BoardState } from "./board-state";
import { tacticsContent } from "./content";
import { describeLine, describeToken, rosterLabel } from "./labels";
import type { BoardRosterPlayer } from "./queries";
import { MAX_LABEL_LENGTH } from "./scene";

import { Button } from "@/components/forms/Button";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";

const { panel } = tacticsContent;

export function SelectionPanel({
  state,
  dispatch,
  roster,
}: {
  state: BoardState;
  dispatch: Dispatch<BoardAction>;
  roster: readonly BoardRosterPlayer[];
}) {
  const { scene, selectedId, step } = state;
  const token = scene.tokens.find((candidate) => candidate.id === selectedId);
  const move =
    token && !state.playback ? moveIn(scene, step, token.id) : undefined;
  const line = scene.lines.find((candidate) => candidate.id === selectedId);

  if (!token && !line) {
    return (
      <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
        {panel.none}
      </p>
    );
  }

  const title = token
    ? describeToken(token, roster)
    : line
      ? describeLine(line, scene)
      : "";

  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      <p className="text-[length:var(--fs-body)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]">
        {title}
      </p>
      {token?.kind === "player" && (
        <div className="grid gap-[var(--space-3)] sm:grid-cols-2 sm:items-start">
          <Input
            label={panel.label}
            hint={panel.labelHint}
            value={token.label}
            maxLength={MAX_LABEL_LENGTH}
            autoComplete="off"
            onChange={(event) =>
              dispatch({
                type: "setLabel",
                id: token.id,
                label: [...event.target.value]
                  .slice(0, MAX_LABEL_LENGTH)
                  .join(""),
                playerId: token.playerId,
              })
            }
          />
          {roster.length > 0 && (
            <Select
              label={panel.roster}
              value={token.playerId ?? ""}
              options={[
                { value: "", label: panel.rosterNone },
                ...roster.map((player) => ({
                  value: player.id,
                  label:
                    player.jerseyNumber === null
                      ? player.name
                      : `${player.jerseyNumber} - ${player.name}`,
                })),
              ]}
              onChange={(event) => {
                const player = roster.find(
                  (candidate) => candidate.id === event.target.value,
                );
                dispatch({
                  type: "setLabel",
                  id: token.id,
                  label: player ? rosterLabel(player) : token.label,
                  playerId: player?.id ?? null,
                });
              }}
            />
          )}
        </div>
      )}
      {token && move && (
        <div className="flex flex-col gap-[var(--space-2)]">
          <p className="text-[length:var(--fs-body-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--text-secondary)]">
            {panel.run(step)}
          </p>
          <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
            {panel.runHint}
          </p>
          <div className="flex flex-wrap gap-[var(--space-2)]">
            <Button
              size="sm"
              variant="secondary"
              disabled={!move.via}
              onClick={() => dispatch({ type: "straighten", id: token.id })}
            >
              {panel.straighten}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => dispatch({ type: "resetMove", id: token.id })}
            >
              {panel.resetMove}
            </Button>
          </div>
        </div>
      )}
      <div>
        <Button
          size="sm"
          variant="ghost"
          iconLeft="trash-2"
          className="text-[color:var(--danger)]"
          onClick={() =>
            selectedId && dispatch({ type: "remove", id: selectedId })
          }
        >
          {panel.remove}
        </Button>
      </div>
    </div>
  );
}
