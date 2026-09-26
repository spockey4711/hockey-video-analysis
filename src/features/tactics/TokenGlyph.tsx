/**
 * How a token looks on the board: a disc in its team's colour with its label,
 * or the ball, and a ring while it is selected, at the sizes of the view on
 * show. Shared by the editable board and the read-only scene view, drawn at
 * the token's own origin.
 */
import type { Turn } from "./geometry";
import type { BoardToken, Team } from "./scene";
import { labelFontSize, type BoardSizes } from "./token-size";

import { cn } from "@/components/core/cn";

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
/** The halo round a label grown past its disc: the disc's own colour. */
const TEAM_HALO: Record<Team, string> = {
  home: "stroke-[var(--board-home)]",
  away: "stroke-[var(--board-away)]",
};
/** A halo's width as a share of the label's font size. */
const HALO_WIDTH = 0.3;

/** The radius of a token's disc at a view's sizes. */
export function tokenRadius(token: BoardToken, sizes: BoardSizes): number {
  return token.kind === "ball" ? sizes.ball : sizes.player;
}

export function TokenGlyph({
  token,
  selected = false,
  turn,
  sizes,
  pxPerMetre,
}: {
  token: BoardToken;
  selected?: boolean;
  /** How the board is turned on screen; the label turns back to read upright. */
  turn: Turn;
  /** The sizes of the view on show. */
  sizes: BoardSizes;
  /** How large a metre is on screen, which keeps a label readable. */
  pxPerMetre: number;
}) {
  const radius = tokenRadius(token, sizes);
  const label = token.kind === "player" ? token.label : "";
  const fontSize = labelFontSize(label, sizes, pxPerMetre);
  const grown = fontSize > labelFontSize(label, sizes, 0);
  return (
    <>
      {selected && (
        <circle
          r={radius + sizes.ringGap}
          className="fill-none stroke-[var(--board-selected)]"
          strokeWidth={sizes.ringWidth}
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
        strokeWidth={sizes.edge}
      />
      {token.kind === "player" && label && (
        <text
          // Turn the number back against the board so it reads upright.
          transform={LABEL_TURN[turn]}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fontSize}
          // A label grown past its disc sits on a halo of the disc's colour,
          // drawn under the glyphs.
          strokeWidth={grown ? fontSize * HALO_WIDTH : undefined}
          strokeLinejoin="round"
          paintOrder="stroke"
          className={cn(
            "pointer-events-none [font-weight:var(--fw-bold)]",
            TEAM_INK[token.team],
            grown && TEAM_HALO[token.team],
          )}
        >
          {label}
        </text>
      )}
    </>
  );
}
