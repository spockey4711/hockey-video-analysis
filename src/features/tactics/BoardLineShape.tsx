import {
  arrowHeadPath,
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
 * a solid arrowhead. An arrow is laid down as one translucent group, like on
 * the video, so the halo, shaft and head show no darker seams where they
 * overlap. A selected line gets a wide highlight underneath.
 */
export function BoardLineShape({
  line,
  selected = false,
}: {
  line: BoardLine;
  selected?: boolean;
}) {
  const d = linePath(line);
  const head = arrowHeadPath(line);
  const { halo, pen } = bodyStrokes(line);
  const width = boardPenWidth(line.width);

  return (
    <g
      opacity={head ? ARROW_ALPHA : 1}
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
          d={d}
          fill="none"
          strokeWidth={halo.width}
          strokeDasharray={halo.dash}
        />
        {head && <path d={head} strokeWidth={headHaloWidth(line)} />}
      </g>
      <g className={PEN[line.color]}>
        <path
          d={d}
          fill="none"
          strokeWidth={pen.width}
          strokeDasharray={pen.dash}
        />
        {head && <path d={head} strokeWidth={width} />}
      </g>
    </g>
  );
}
