/**
 * The key to the play lines: a sample of each play tool the scene draws,
 * named. It shows under the editor's board, under the board over presentation
 * mode and on the stage of a scene in a collection, so whoever watches reads a
 * dotted arrow as a run and a wavy one as a dribble. A scene with no play
 * lines shows no legend.
 */
import { tacticsContent } from "./content";
import {
  arrowHeadPath,
  blockBarPath,
  bodyPath,
  bodyStrokes,
  boardPenWidth,
} from "./line-paths";
import {
  PLAY_TOOL_STYLE,
  playToolsIn,
  type BoardLine,
  type PlayTool,
} from "./scene";

import { cn } from "@/components/core/cn";

/** The sample's box in metres: a line along the middle, with room for the wave. */
const GLYPH_WIDTH = 8;
const GLYPH_HEIGHT = 2;
/** The share of the board pen the samples draw with, so they read at icon size. */
const GLYPH_PEN = 1.4;

/**
 * A play tool drawn as a small sample in the text colour, from the same
 * geometry as the board draws it, without the halo the pitch needs.
 */
export function LineGlyph({
  tool,
  className,
}: {
  tool: PlayTool;
  className?: string;
}) {
  const line = {
    tool,
    width: "medium",
    style: PLAY_TOOL_STYLE[tool],
    points: [
      { x: 0.6, y: GLYPH_HEIGHT / 2 },
      { x: GLYPH_WIDTH - 0.6, y: GLYPH_HEIGHT / 2 },
    ],
  } satisfies Pick<BoardLine, "tool" | "width" | "style" | "points">;
  const { pen } = bodyStrokes(line, GLYPH_PEN);
  const head = arrowHeadPath(line, GLYPH_PEN);
  const bar = blockBarPath(line, GLYPH_PEN);
  const width = boardPenWidth(line.width, GLYPH_PEN);
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${GLYPH_WIDTH} ${GLYPH_HEIGHT}`}
      className={cn(
        "h-[var(--space-2)] w-[var(--space-8)] shrink-0",
        className,
      )}
      fill="currentColor"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d={bodyPath(line, GLYPH_PEN)}
        fill="none"
        strokeWidth={pen.width}
        strokeDasharray={pen.dash}
      />
      {head && <path d={head} strokeWidth={width} />}
      {bar && <path d={bar} fill="none" strokeWidth={width} />}
    </svg>
  );
}

export function LineLegend({
  lines,
  className,
}: {
  /** Every line of the scene, so the legend stays put while steps play. */
  lines: readonly BoardLine[];
  className?: string;
}) {
  const tools = playToolsIn(lines);
  if (tools.length === 0) return null;
  const { board } = tacticsContent;
  return (
    <ul
      aria-label={board.legend}
      className={cn(
        "flex flex-wrap items-center gap-x-[var(--space-3)] gap-y-[var(--space-1)] text-[length:var(--fs-caption)]",
        className,
      )}
    >
      {tools.map((tool) => (
        <li key={tool} className="flex items-center gap-[0.33em]">
          <LineGlyph tool={tool} className="h-[0.67em] w-[2.67em]" />
          {board.modes[tool]}
        </li>
      ))}
    </ul>
  );
}
