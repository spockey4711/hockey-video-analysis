import {
  arrowHeadPath,
  blockBarPath,
  bodyPath,
  bodyStrokes,
  boardPenWidth,
  headHaloWidth,
  linePath,
} from "./line-paths";
import type { BoardLine } from "./scene";

import { ARROW_ALPHA, HALO_ALPHA } from "@/features/player/telestration/render";
import type { PenColor } from "@/features/player/telestration/state";

/** Pen fills and strokes, spelled out so Tailwind sees each `--draw-*` class. */
const PEN: Record<PenColor, string> = {
  red: "fill-[var(--draw-red)] stroke-[var(--draw-red)]",
  yellow: "fill-[var(--draw-yellow)] stroke-[var(--draw-yellow)]",
  blue: "fill-[var(--draw-blue)] stroke-[var(--draw-blue)]",
  white: "fill-[var(--draw-white)] stroke-[var(--draw-white)]",
};

/**
 * One board line in the telestration look: the dark halo, then the pen, then
 * a solid arrowhead or a block's end bar. An arrow or a block is laid down as
 * one translucent group, like an arrow on the video, so the halo, shaft and
 * end show no darker seams where they overlap. A dribble's shaft is its wave.
 * A selected line gets a wide highlight underneath, along its plain path.
 */
export function BoardLineShape({
  line,
  selected = false,
  pen: penShare = 1,
}: {
  line: BoardLine;
  selected?: boolean;
  /** The share of the board pen the view draws lines with. */
  pen?: number;
}) {
  const d = linePath(line);
  const body = bodyPath(line, penShare);
  const head = arrowHeadPath(line, penShare);
  const bar = blockBarPath(line, penShare);
  const { halo, pen } = bodyStrokes(line, penShare);
  const width = boardPenWidth(line.width, penShare);

  return (
    <g
      opacity={head || bar ? ARROW_ALPHA : 1}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {selected && (
        <path
          d={d}
          className="fill-none stroke-[var(--board-selected)]"
          strokeWidth={halo.width + width * 2}
          opacity={0.6}
        />
      )}
      <g
        opacity={HALO_ALPHA}
        className="fill-[var(--draw-halo)] stroke-[var(--draw-halo)]"
      >
        <path
          d={body}
          fill="none"
          strokeWidth={halo.width}
          strokeDasharray={halo.dash}
        />
        {head && <path d={head} strokeWidth={headHaloWidth(line, penShare)} />}
        {bar && (
          <path
            d={bar}
            fill="none"
            strokeWidth={headHaloWidth(line, penShare)}
          />
        )}
      </g>
      <g className={PEN[line.color]}>
        <path
          d={body}
          fill="none"
          strokeWidth={pen.width}
          strokeDasharray={pen.dash}
        />
        {head && <path d={head} strokeWidth={width} />}
        {bar && <path d={bar} fill="none" strokeWidth={width} />}
      </g>
    </g>
  );
}
