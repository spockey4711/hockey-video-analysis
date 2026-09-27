/**
 * The board drawn for a picture (S7): the pitch in its run-off colour filling
 * the picture's shape, the zones, lines, tokens and texts as they stand at one
 * moment, lying landscape like the scene's stage on the collection link. It
 * draws what the players see, never an editing aid: no selection, no run
 * trails, no half-drawn line or zone. A roster name reaches the picture only
 * when the coach's board passes `names`, which it does only while it shows
 * names itself. The play lines' legend sits in the bottom-left corner and the
 * step's caption along the bottom, as on the stage. `renderBoardImage` turns
 * it into the PNG.
 */
import { useId, type Ref } from "react";

import { BoardLineShape } from "./BoardLineShape";
import { TextShape, ZonePatterns, ZoneShape } from "./BoardShapeView";
import { LineGlyph } from "./LineLegend";
import { MARKING_WIDTH, PitchMarkings } from "./PitchMarkings";
import { TokenGlyph, TokenTags } from "./TokenGlyph";
import type { SceneFrame } from "./animation";
import { IMAGE_DENSITY, imageFrame, type ImagePreset } from "./board-image";
import { tacticsContent } from "./content";
import { boardLayout, viewMatrix, viewSize } from "./geometry";
import type { PitchView } from "./pitch";
import { isZone, type PlayTool } from "./scene";
import { boardSizes } from "./token-size";
import { visibleFrame } from "./visibility";

export function BoardImage({
  view,
  frame,
  preset,
  legend,
  title,
  names,
  ref,
}: {
  /** The part of the pitch the scene shows. */
  view: PitchView;
  /** The tokens, lines and shapes at the moment on show. */
  frame: SceneFrame;
  preset: ImagePreset;
  /** The play tools the scene uses, named in the legend; none shows no legend. */
  legend: readonly PlayTool[];
  /** The picture's accessible name. */
  title: string;
  /** The short name each named token shows under its disc; left out, none. */
  names?: ReadonlyMap<string, string>;
  ref?: Ref<SVGSVGElement>;
}) {
  const layout = boardLayout(view, "landscape");
  const picture = imageFrame(viewSize(layout), preset);
  const sizes = boardSizes(view);
  const shown = visibleFrame(frame, layout.bounds, sizes.player);
  const { x, y, width, height } = picture.viewBox;
  // Labels and texts keep the size they have on a screen of the picture's
  // density, so the smallest one still reads.
  const pxPerMetre = picture.pxPerMetre / IMAGE_DENSITY;
  const patterns = `picture${useId().replace(/[^\w-]/g, "")}`;
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
      <ZonePatterns prefix={patterns} sizes={sizes} />
      <g transform={viewMatrix(layout)}>
        <PitchMarkings lineWidth={MARKING_WIDTH * IMAGE_DENSITY} />
        {shown.shapes.filter(isZone).map((zone) => (
          <ZoneShape
            key={zone.id}
            zone={zone}
            sizes={sizes}
            patterns={patterns}
          />
        ))}
        {shown.lines.map((line) => (
          <BoardLineShape key={line.id} line={line} pen={sizes.pen} />
        ))}
        {shown.tokens.map((token) => (
          <g key={token.id} transform={`translate(${token.x} ${token.y})`}>
            <TokenGlyph
              token={token}
              turn={layout.turn}
              sizes={sizes}
              pxPerMetre={pxPerMetre}
            />
          </g>
        ))}
        <TokenTags
          tokens={shown.tokens}
          names={names}
          turn={layout.turn}
          sizes={sizes}
          pxPerMetre={pxPerMetre}
        />
        {shown.shapes.map(
          (shape) =>
            shape.kind === "text" && (
              <TextShape
                key={shape.id}
                shape={shape}
                turn={layout.turn}
                sizes={sizes}
                pxPerMetre={pxPerMetre}
              />
            ),
        )}
      </g>
      {(legend.length > 0 || frame.caption) && (
        // The legend and the caption are laid out in image pixels from the
        // picture's corner.
        <g transform={`translate(${x} ${y}) scale(${1 / picture.pxPerMetre})`}>
          {legend.length > 0 && (
            <PictureLegend
              tools={legend}
              width={picture.width}
              height={picture.height}
            />
          )}
          {frame.caption && (
            <PictureCaption
              caption={frame.caption}
              width={picture.width}
              height={picture.height}
            />
          )}
        </g>
      )}
    </svg>
  );
}

/**
 * The legend's text size as a share of the picture's width: what the stage's
 * corner legend reaches on a large screen.
 */
const LEGEND_TEXT = 0.015;
/**
 * A generous average glyph width in the app font, in ems, which sizes the
 * legend's backing to its longest name (an SVG box cannot grow with its text).
 */
const CHAR_WIDTH = 0.55;

/** The caption's text size as a share of the picture's width, as on the stage. */
const CAPTION_TEXT = 0.022;
/** The share of the picture's width a caption may take, clear of the legend. */
const CAPTION_WIDTH = 0.64;
/**
 * The average glyph width of a caption, in ems: a sentence of mixed case in
 * the app font runs narrower than the legend's generous estimate, and the
 * backing is sized to it.
 */
const CAPTION_CHAR_WIDTH = 0.47;

/**
 * The step's caption centred along the picture's bottom, in image pixels: the
 * stage's caption (`StageCaption`) redrawn in SVG on the video scrim. An SVG
 * text does not wrap, so a long caption gets a smaller size to fit its line.
 */
function PictureCaption({
  caption,
  width,
  height,
}: {
  caption: string;
  width: number;
  height: number;
}) {
  const chars = [...caption].length;
  const em = Math.min(
    width * CAPTION_TEXT,
    (width * CAPTION_WIDTH) / (chars * CAPTION_CHAR_WIDTH + 1.4),
  );
  const box = {
    width: chars * em * CAPTION_CHAR_WIDTH + em * 1.4,
    height: em * 1.6,
  };
  const top = height - width * CAPTION_TEXT - box.height;
  return (
    <g className="fill-[var(--video-ink)]">
      <rect
        x={(width - box.width) / 2}
        y={top}
        width={box.width}
        height={box.height}
        rx={em * 0.3}
        className="fill-[var(--video-scrim)]"
      />
      <text
        x={width / 2}
        y={top + box.height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={em}
      >
        {caption}
      </text>
    </g>
  );
}

/**
 * The key to the play lines in the picture's bottom-left corner, in image
 * pixels: the stage's corner legend (`CornerLegend`) redrawn in SVG, a sample
 * of each tool and its name on the video scrim.
 */
function PictureLegend({
  tools,
  width,
  height,
}: {
  tools: readonly PlayTool[];
  width: number;
  height: number;
}) {
  const { modes } = tacticsContent.board;
  const em = width * LEGEND_TEXT;
  const row = em * 1.25;
  const glyph = { width: em * 2.67, height: em * 0.67 };
  const gap = em * 0.33;
  const pad = { x: em * 0.6, y: em * 0.3 };
  const longest = Math.max(...tools.map((tool) => [...modes[tool]].length));
  const box = {
    width: pad.x * 2 + glyph.width + gap + longest * em * CHAR_WIDTH,
    height: pad.y * 2 + row * tools.length,
  };
  const left = em * 0.6;
  const top = height - em * 0.6 - box.height;
  return (
    <g className="fill-[var(--video-ink)] text-[color:var(--video-ink)]">
      <rect
        x={left}
        y={top}
        width={box.width}
        height={box.height}
        rx={em * 0.3}
        className="fill-[var(--video-scrim)]"
      />
      {tools.map((tool, index) => {
        const middle = top + pad.y + row * (index + 0.5);
        return (
          <g key={tool}>
            <LineGlyph
              tool={tool}
              x={left + pad.x}
              y={middle - glyph.height / 2}
              width={glyph.width}
              height={glyph.height}
            />
            <text
              x={left + pad.x + glyph.width + gap}
              y={middle}
              dominantBaseline="central"
              fontSize={em}
            >
              {modes[tool]}
            </text>
          </g>
        );
      })}
    </g>
  );
}
