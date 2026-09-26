/**
 * How a token looks on the board: a disc in its team's colour with its label,
 * or the ball, and a ring while it is selected, at the sizes of the view on
 * show. Under a player's disc a tag names its position code and, when the
 * coach's board shows names, the roster player's short name. Shared by the
 * editable board and the read-only scene view, drawn at the token's own
 * origin.
 */
import type { Turn } from "./geometry";
import type { BoardToken, Team } from "./scene";
import { labelFontSize, tagFontSize, type BoardSizes } from "./token-size";

import { cn } from "@/components/core/cn";

/** Turns a label back against the board so it reads upright. */
export const LABEL_TURN: Record<Turn, string | undefined> = {
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
  name,
}: {
  token: BoardToken;
  selected?: boolean;
  /** How the board is turned on screen; the label turns back to read upright. */
  turn: Turn;
  /** The sizes of the view on show. */
  sizes: BoardSizes;
  /** How large a metre is on screen, which keeps a label readable. */
  pxPerMetre: number;
  /** The roster player's short name to show under the disc; left out, none. */
  name?: string;
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
      {token.kind === "player" && (
        <TokenTag
          position={token.position}
          name={name}
          below={radius + sizes.edge / 2 + sizes.tagGap}
          turn={turn}
          fontSize={tagFontSize(sizes, pxPerMetre)}
        />
      )}
    </>
  );
}

/**
 * The tag under a disc: the position code in bold and the name, on a dark
 * halo so it reads over the turf, the lines and its neighbours. It turns back
 * against the board like the label and hangs below the disc as the screen
 * shows it.
 */
function TokenTag({
  position,
  name,
  below,
  turn,
  fontSize,
}: {
  position: string;
  name: string | undefined;
  /** How far under the token's centre the tag starts, in metres. */
  below: number;
  turn: Turn;
  fontSize: number;
}) {
  if (!position && !name) return null;
  return (
    <text
      data-token-tag
      transform={LABEL_TURN[turn]}
      y={below + fontSize / 2}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={fontSize}
      strokeWidth={fontSize * HALO_WIDTH}
      strokeLinejoin="round"
      paintOrder="stroke"
      className="pointer-events-none fill-[var(--board-tag)] stroke-[var(--board-tag-halo)] [font-weight:var(--fw-medium)]"
    >
      {position && (
        <tspan className="[font-weight:var(--fw-bold)]">{position}</tspan>
      )}
      {position && name ? " " : null}
      {name}
    </text>
  );
}
