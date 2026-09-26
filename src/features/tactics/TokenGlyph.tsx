/**
 * How a token looks on the board: a disc in its team's colour with its label,
 * or the ball, and a ring while it is selected. Shared by the editable board
 * and the read-only scene view, drawn at the token's own origin.
 */
import type { Turn } from "./geometry";
import type { BoardToken, Team } from "./scene";

import { cn } from "@/components/core/cn";

/** Token sizes in metres: large enough to read, not to scale. */
export const PLAYER_RADIUS = 1.2;
export const BALL_RADIUS = 0.55;

const LABEL_TURN: Record<Turn, string | undefined> = {
  none: undefined,
  left: "rotate(90)",
  right: "rotate(-90)",
};

const TEAM_FILL: Record<Team, string> = {
  home: "fill-[var(--board-home)]",
  away: "fill-[var(--board-away)]",
};
const TEAM_INK: Record<Team, string> = {
  home: "fill-[var(--board-home-ink)]",
  away: "fill-[var(--board-away-ink)]",
};

export function TokenGlyph({
  token,
  selected = false,
  turn,
}: {
  token: BoardToken;
  selected?: boolean;
  /** How the board is turned on screen; the label turns back to read upright. */
  turn: Turn;
}) {
  const radius = token.kind === "ball" ? BALL_RADIUS : PLAYER_RADIUS;
  const label = token.kind === "player" ? token.label : "";
  return (
    <>
      {selected && (
        <circle
          r={radius + 0.5}
          className="fill-none stroke-[var(--board-selected)]"
          strokeWidth={0.3}
        />
      )}
      <circle
        r={radius}
        className={cn(
          "stroke-[var(--board-edge)]",
          token.kind === "ball"
            ? "fill-[var(--board-ball)]"
            : TEAM_FILL[token.team],
        )}
        strokeWidth={0.15}
      />
      {token.kind === "player" && label && (
        <text
          // Turn the number back against the board so it reads upright.
          transform={LABEL_TURN[turn]}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={[...label].length > 2 ? 0.95 : 1.3}
          className={cn(
            "pointer-events-none [font-weight:var(--fw-bold)]",
            TEAM_INK[token.team],
          )}
        >
          {label}
        </text>
      )}
    </>
  );
}
