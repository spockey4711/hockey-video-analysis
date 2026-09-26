/**
 * How a zone and a text look on the board, at the sizes of the view on show.
 * Shared by the editable board, the collection stage and the picture.
 *
 * A zone is see-through, so the tokens and lines over it stay visible: a tint
 * of its pen, or its pen's hatching, inside its outline on a dark halo. A
 * text stands upright however the board is turned: the pen's colour on a dark
 * halo, or dark ink in a speech bubble of the pen's colour.
 */
import { LABEL_TURN } from "./TokenGlyph";
import type { Turn } from "./geometry";
import type { BoardText, BoardZone } from "./scene";
import { bubblePath, textBox, zonePath } from "./shape-paths";
import { textFontSize, type BoardSizes } from "./token-size";

import { cn } from "@/components/core/cn";
import { HALO_ALPHA } from "@/features/player/telestration/render";
import {
  PEN_COLORS,
  type PenColor,
} from "@/features/player/telestration/state";

/** Pen paints, spelled out so Tailwind sees each `--draw-*` class. */
const FILL: Record<PenColor, string> = {
  red: "fill-[var(--draw-red)]",
  yellow: "fill-[var(--draw-yellow)]",
  blue: "fill-[var(--draw-blue)]",
  white: "fill-[var(--draw-white)]",
};
const STROKE: Record<PenColor, string> = {
  red: "stroke-[var(--draw-red)]",
  yellow: "stroke-[var(--draw-yellow)]",
  blue: "stroke-[var(--draw-blue)]",
  white: "stroke-[var(--draw-white)]",
};
/** The words in a bubble: the dark ink of the bubble's colour. */
const BUBBLE_INK: Record<PenColor, string> = {
  red: "fill-[var(--board-bubble-ink-red)]",
  yellow: "fill-[var(--board-bubble-ink-yellow)]",
  blue: "fill-[var(--board-bubble-ink-blue)]",
  white: "fill-[var(--board-bubble-ink-white)]",
};

/** How much of a tinted zone's pen shows through: the pitch stays readable. */
export const ZONE_ALPHA = 0.3;
/** How strongly a zone's outline and hatching show. */
const ZONE_EDGE_ALPHA = 0.85;
/** A plain text's halo, as a share of its font size. */
const TEXT_HALO = 0.25;

/** The id of the hatching of one pen, under a board's own prefix. */
export function hatchId(prefix: string, color: PenColor): string {
  return `${prefix}-hatch-${color}`;
}

/**
 * The hatching a zone of each pen fills with: diagonal lines in pitch metres,
 * so they turn with the board. One set per SVG, its ids under `prefix`, since
 * a page can show several boards.
 */
export function ZonePatterns({
  prefix,
  sizes,
}: {
  prefix: string;
  sizes: BoardSizes;
}) {
  return (
    <defs>
      {PEN_COLORS.map((color) => (
        <pattern
          key={color}
          id={hatchId(prefix, color)}
          patternUnits="userSpaceOnUse"
          width={sizes.hatch}
          height={sizes.hatch}
          patternTransform="rotate(45)"
        >
          <line
            x1={sizes.hatch / 2}
            y1={0}
            x2={sizes.hatch / 2}
            y2={sizes.hatch}
            className={STROKE[color]}
            strokeWidth={sizes.hatchWidth}
            strokeOpacity={ZONE_EDGE_ALPHA}
          />
        </pattern>
      ))}
    </defs>
  );
}

export function ZoneShape({
  zone,
  selected = false,
  sizes,
  patterns,
}: {
  zone: BoardZone;
  selected?: boolean;
  sizes: BoardSizes;
  /** The prefix of the board's {@link ZonePatterns}. */
  patterns: string;
}) {
  const d = zonePath(zone);
  const hatched = zone.fill === "hatch";
  return (
    <g strokeLinejoin="round">
      {selected && (
        <path
          d={d}
          className="fill-none stroke-[var(--board-selected)]"
          strokeWidth={sizes.zoneEdge + sizes.ringWidth * 2}
          opacity={0.6}
        />
      )}
      <path
        d={d}
        className="fill-none stroke-[var(--draw-halo)]"
        strokeWidth={sizes.zoneEdge * 2.5}
        opacity={HALO_ALPHA}
      />
      <path
        d={d}
        className={cn(STROKE[zone.color], !hatched && FILL[zone.color])}
        fill={hatched ? `url(#${hatchId(patterns, zone.color)})` : undefined}
        fillOpacity={hatched ? 1 : ZONE_ALPHA}
        strokeOpacity={ZONE_EDGE_ALPHA}
        strokeWidth={sizes.zoneEdge}
      />
    </g>
  );
}

export function TextShape({
  shape,
  selected = false,
  turn,
  sizes,
  pxPerMetre,
  hitArea = false,
}: {
  shape: BoardText;
  selected?: boolean;
  /** How the board is turned on screen; the text turns back to read upright. */
  turn: Turn;
  sizes: BoardSizes;
  /** How large a metre is on screen, which keeps the text readable. */
  pxPerMetre: number;
  /** Catch a pointer on the whole box, not only on the glyphs. */
  hitArea?: boolean;
}) {
  const fontSize = textFontSize(sizes, pxPerMetre);
  const box = textBox(shape.text, fontSize, shape.bubble);
  const ring = sizes.ringGap;
  return (
    <g transform={`translate(${shape.x} ${shape.y})`}>
      <g transform={LABEL_TURN[turn]}>
        {hitArea && (
          <rect
            x={-box.width / 2}
            y={-box.height / 2}
            width={box.width}
            height={box.height}
            className="fill-transparent"
          />
        )}
        {selected && (
          <rect
            x={-box.width / 2 - ring}
            y={-box.height / 2 - ring}
            width={box.width + ring * 2}
            height={box.height + ring * 2}
            rx={ring}
            className="fill-none stroke-[var(--board-selected)]"
            strokeWidth={sizes.ringWidth}
          />
        )}
        {shape.bubble && (
          <path
            d={bubblePath(box, fontSize)}
            className={cn(FILL[shape.color], "stroke-[var(--board-edge)]")}
            strokeWidth={sizes.edge}
            strokeLinejoin="round"
          />
        )}
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fontSize}
          strokeWidth={shape.bubble ? undefined : fontSize * TEXT_HALO}
          strokeLinejoin="round"
          paintOrder="stroke"
          className={cn(
            "pointer-events-none [font-weight:var(--fw-bold)]",
            shape.bubble
              ? BUBBLE_INK[shape.color]
              : `${FILL[shape.color]} stroke-[var(--draw-halo)]`,
          )}
        >
          {shape.text}
        </text>
      </g>
    </g>
  );
}
