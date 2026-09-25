import {
  BOARD_BOUNDS,
  BOUNDARY,
  goalRects,
  PITCH_LENGTH,
  PITCH_WIDTH,
  pitchMarkings,
} from "./pitch";

/**
 * The markings are computed once: they never change, only the transform
 * around them does.
 */
const MARKINGS = pitchMarkings();
const GOALS = goalRects();

/**
 * The pitch in pitch metres: run-off, turf, goals and every FIH marking. The
 * lines are placed to scale but drawn a fixed 1.5 screen pixels wide
 * (`non-scaling-stroke`): a true 75 mm line would vanish on a phone.
 */
export function PitchMarkings() {
  const { minX, minY, maxX, maxY } = BOARD_BOUNDS;
  return (
    <g aria-hidden>
      <rect
        x={minX}
        y={minY}
        width={maxX - minX}
        height={maxY - minY}
        className="fill-[var(--board-runoff)]"
      />
      <rect
        x={0}
        y={0}
        width={PITCH_LENGTH}
        height={PITCH_WIDTH}
        className="fill-[var(--board-turf)]"
      />
      <g className="fill-none stroke-[var(--board-marking)]" strokeWidth={1.5}>
        {GOALS.map((goal) => (
          <rect
            key={goal.x}
            x={goal.x}
            y={goal.y}
            width={goal.w}
            height={goal.h}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <rect {...BOUNDARY} vectorEffect="non-scaling-stroke" />
        {MARKINGS.map((marking, index) =>
          marking.kind === "path" ? (
            <path key={index} d={marking.d} vectorEffect="non-scaling-stroke" />
          ) : (
            <circle
              key={index}
              cx={marking.at.x}
              cy={marking.at.y}
              // A 150 mm spot is a speck on screen; draw it a touch larger.
              r={marking.r * 2}
              className="fill-[var(--board-marking)] stroke-none"
            />
          ),
        )}
      </g>
    </g>
  );
}
