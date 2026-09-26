/**
 * The board drawn for a picture (S7): the pitch in its run-off colour filling
 * the picture's shape, the lines and the tokens as they stand at one moment,
 * lying landscape like the scene's stage on the collection link. It draws
 * what the players see, never an editing aid: no selection, no run trails, no
 * half-drawn line. Tokens show their label only, so no roster name reaches a
 * picture. `renderBoardImage` turns it into the PNG.
 */
import type { Ref } from "react";

import { BoardLineShape } from "./BoardLineShape";
import { MARKING_WIDTH, PitchMarkings } from "./PitchMarkings";
import { TokenGlyph } from "./TokenGlyph";
import type { SceneFrame } from "./animation";
import { IMAGE_DENSITY, imageFrame, type ImagePreset } from "./board-image";
import { boardLayout, viewMatrix, viewSize } from "./geometry";
import type { PitchView } from "./pitch";
import { boardSizes } from "./token-size";
import { visibleFrame } from "./visibility";

export function BoardImage({
  view,
  frame,
  preset,
  title,
  ref,
}: {
  /** The part of the pitch the scene shows. */
  view: PitchView;
  /** The tokens and lines at the moment on show. */
  frame: SceneFrame;
  preset: ImagePreset;
  /** The picture's accessible name. */
  title: string;
  ref?: Ref<SVGSVGElement>;
}) {
  const layout = boardLayout(view, "landscape");
  const picture = imageFrame(viewSize(layout), preset);
  const sizes = boardSizes(view);
  const shown = visibleFrame(frame, layout.bounds, sizes.player);
  const { x, y, width, height } = picture.viewBox;
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      width={picture.width}
      height={picture.height}
      viewBox={`${x} ${y} ${width} ${height}`}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        className="fill-[var(--board-runoff)]"
      />
      <g transform={viewMatrix(layout)}>
        <PitchMarkings lineWidth={MARKING_WIDTH * IMAGE_DENSITY} />
        {shown.lines.map((line) => (
          <BoardLineShape key={line.id} line={line} pen={sizes.pen} />
        ))}
        {shown.tokens.map((token) => (
          <g key={token.id} transform={`translate(${token.x} ${token.y})`}>
            <TokenGlyph
              token={token}
              turn={layout.turn}
              sizes={sizes}
              // Labels keep the size they have on a screen of the picture's
              // density, so the smallest one still reads.
              pxPerMetre={picture.pxPerMetre / IMAGE_DENSITY}
            />
          </g>
        ))}
      </g>
    </svg>
  );
}
