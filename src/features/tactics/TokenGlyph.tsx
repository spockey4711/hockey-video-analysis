/**
 * How a token looks on the board: a disc in its team's colour with its label,
 * or the ball, and a ring while it is selected, at the sizes of the view on
 * show, and the tags under the players' discs. Shared by the editable board,
 * the read-only scene view and the picture. A glyph is drawn at the token's
 * own origin; the tags are drawn after all the tokens, so no disc covers the
 * tag of a player standing just above it.
 */
import type { Turn } from "./geometry";
import type { BoardToken, Team } from "./scene";
import { TAG_ROW_HEIGHT, tagRows } from "./tag-layout";
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

/**
 * The tags under the players' discs: each player's position code in bold and,
 * when the coach's board shows names, the roster player's short name, on a
 * dark halo so they read over the turf, the lines and the other tokens. Each
 * turns back against the board like a label and hangs below its disc as the
 * screen shows it, a row lower where it would run into another (`tagRows`).
 */
export function TokenTags({
  tokens,
  names,
  turn,
  sizes,
  pxPerMetre,
}: {
  /** The tokens on show, where they stand. */
  tokens: readonly BoardToken[];
  /** The short name each named token shows, by token id; left out, none. */
  names?: ReadonlyMap<string, string>;
  turn: Turn;
  sizes: BoardSizes;
  pxPerMetre: number;
}) {
  const fontSize = tagFontSize(sizes, pxPerMetre);
  const below = sizes.player + sizes.edge / 2 + sizes.tagGap;
  const tags = tokens.flatMap((token) => {
    if (token.kind !== "player") return [];
    const name = names?.get(token.id);
    const text = [token.position, name].filter(Boolean).join(" ");
    return text
      ? [{ id: token.id, at: token, position: token.position, name, text }]
      : [];
  });
  const rows = tagRows(tags, turn, fontSize);
  return (
    <g aria-hidden className="pointer-events-none">
      {tags.map((tag) => (
        <g
          key={tag.id}
          data-tag-for={tag.id}
          transform={`translate(${tag.at.x} ${tag.at.y})`}
        >
          <TokenTag
            position={tag.position}
            name={tag.name}
            below={below + (rows.get(tag.id) ?? 0) * fontSize * TAG_ROW_HEIGHT}
            turn={turn}
            fontSize={fontSize}
          />
        </g>
      ))}
    </g>
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
