"use client";

/**
 * Edit what is selected on the board: a player's label and roster link, its
 * run in the step on show, a text's words and bubble, or remove a player, the
 * ball, a line, a zone or a text. Several selected items are only counted and
 * removed together; the board moves them.
 */
import { useEffect, useRef, useState, type Dispatch } from "react";

import { moveIn, type BoardAction, type BoardState } from "./board-state";
import { tacticsContent } from "./content";
import {
  describeLine,
  describeShape,
  describeToken,
  rosterLabel,
} from "./labels";
import type { BoardRosterPlayer } from "./queries";
import {
  MAX_LABEL_LENGTH,
  MAX_TEXT_LENGTH,
  normalizeText,
  type BoardText,
} from "./scene";

import { EmptyState } from "@/components/core/EmptyState";
import { Button } from "@/components/forms/Button";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";
import { Switch } from "@/components/forms/Switch";

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
  const { scene, selectedIds, step } = state;
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : undefined;
  const token = scene.tokens.find((candidate) => candidate.id === selectedId);
  const move =
    token && !state.playback ? moveIn(scene, step, token.id) : undefined;
  const line = scene.lines.find((candidate) => candidate.id === selectedId);
  const shape = scene.shapes.find((candidate) => candidate.id === selectedId);

  if (selectedIds.length > 1) {
    return (
      <div className="flex flex-col gap-[var(--space-3)]">
        <p className="text-[length:var(--fs-body)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]">
          {panel.many(selectedIds.length)}
        </p>
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {panel.manyHint}
        </p>
        <RemoveButton
          label={panel.removeAll}
          onClick={() => dispatch({ type: "remove", id: selectedIds[0] ?? "" })}
        />
      </div>
    );
  }

  if (!token && !line && !shape) {
    return <EmptyState icon="mouse-pointer-2" size="sm" title={panel.none} />;
  }

  const title = token
    ? describeToken(token, roster)
    : line
      ? describeLine(line, scene)
      : shape
        ? describeShape(shape, scene)
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
      {shape?.kind === "text" && (
        <TextFields key={shape.id} shape={shape} dispatch={dispatch} />
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
      <RemoveButton
        label={panel.remove}
        onClick={() =>
          selectedId && dispatch({ type: "remove", id: selectedId })
        }
      />
    </div>
  );
}

function RemoveButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <div>
      <Button
        size="sm"
        variant="ghost"
        iconLeft="trash-2"
        className="text-[color:var(--danger)]"
        onClick={onClick}
      >
        {label}
      </Button>
    </div>
  );
}

/**
 * A text's words and whether it stands in a bubble. While the field has focus
 * it keeps what is typed, spaces and all; the board gets the words whenever
 * they make a text, so an emptied field leaves the last words on the board.
 */
function TextFields({
  shape,
  dispatch,
}: {
  shape: BoardText;
  dispatch: Dispatch<BoardAction>;
}) {
  const [typed, setTyped] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);

  // A text still saying what every new one says when its fields first show
  // was just put down: its words are ready to type over.
  const fresh = useRef(shape.text === tacticsContent.board.newText);
  useEffect(() => {
    if (!fresh.current) return;
    field.current?.focus({ preventScroll: true });
    field.current?.select();
  }, []);

  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      <Input
        ref={field}
        label={panel.text}
        hint={panel.textHint}
        value={typed ?? shape.text}
        maxLength={MAX_TEXT_LENGTH}
        autoComplete="off"
        onChange={(event) => {
          const value = event.target.value;
          setTyped(value);
          if (normalizeText(value) !== null)
            dispatch({ type: "setText", id: shape.id, text: value });
        }}
        onBlur={() => setTyped(null)}
      />
      <Switch
        label={panel.bubble}
        checked={shape.bubble}
        onChange={(bubble) =>
          dispatch({ type: "setBubble", id: shape.id, bubble })
        }
      />
    </div>
  );
}
