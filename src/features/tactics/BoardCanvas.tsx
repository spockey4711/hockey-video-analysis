"use client";

/**
 * The board itself: the pitch as an SVG in metres, the lines on it and the
 * tokens on top, as they stand on the step on show or at the moment the
 * animation plays. Pointer drags move tokens, bend a run or draw lines (mouse,
 * pen and touch alike); a token or line takes keyboard focus, which selects
 * it, and the arrow keys nudge the selected token. While the animation plays
 * or rests partway the board only shows.
 */
import {
  useRef,
  type Dispatch,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import { BoardLineShape } from "./BoardLineShape";
import { PitchMarkings } from "./PitchMarkings";
import { BALL_RADIUS, PLAYER_RADIUS, TokenGlyph } from "./TokenGlyph";
import {
  frameAt,
  keyframe,
  keyframePositions,
  movePath,
  pointOnPath,
  type MovePath,
} from "./animation";
import { moveIn, type BoardAction, type BoardState } from "./board-state";
import { tacticsContent } from "./content";
import {
  clientToPitch,
  screenToPitchDelta,
  viewMatrix,
  viewSize,
  type Orientation,
} from "./geometry";
import { describeLine, describeToken } from "./labels";
import { linePath } from "./line-paths";
import type { PitchPoint } from "./pitch";
import type { BoardRosterPlayer } from "./queries";
import type { BoardToken } from "./scene";

import { cn } from "@/components/core/cn";

/** The invisible circle around a token that catches a finger. */
const HIT_RADIUS = 2;
/** A line's invisible hit stroke, in metres. */
const LINE_HIT_WIDTH = 2;
/** The handle that bends a run, and the dashed trail a run leaves. */
const BEND_RADIUS = 0.7;
const TRAIL_WIDTH = 0.2;

/** Arrow-key nudge steps in metres: plain and with Shift. */
export const NUDGE_STEP = 0.5;
export const NUDGE_STEP_LARGE = 5;

const ARROW_KEYS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export interface BoardCanvasProps {
  readonly state: BoardState;
  readonly dispatch: Dispatch<BoardAction>;
  readonly orientation: Orientation;
  readonly roster: readonly BoardRosterPlayer[];
  /**
   * Fit the pitch into the height of the nearest size container (presentation
   * mode) instead of the viewport less room for the editor's controls.
   */
  readonly fit?: "viewport" | "container";
}

/**
 * What the pointer is doing right now: dragging a token, bending its run, or
 * drawing a line.
 */
type Gesture =
  | { kind: "drag"; pointerId: number; id: string; offset: PitchPoint }
  | { kind: "bend"; pointerId: number; id: string; offset: PitchPoint }
  | { kind: "draw"; pointerId: number };

/**
 * Keep receiving a pointer's moves while it is dragged off the board. Capture
 * can fail for a pointer that is already gone (or a synthetic one); the
 * gesture then still works while the pointer stays over the board.
 */
function capture(event: PointerEvent<SVGSVGElement>): void {
  try {
    event.currentTarget.setPointerCapture(event.pointerId);
  } catch {
    // Not capturable: carry on uncaptured.
  }
}

export function BoardCanvas({
  state,
  dispatch,
  orientation,
  roster,
  fit = "viewport",
}: BoardCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const { scene, selectedId, mode, draft, step, playback } = state;
  const view = viewSize(orientation);
  const frame = playback
    ? frameAt(scene, playback.time)
    : keyframe(scene, step);
  const still = playback !== null;
  const moving = mode === "move" && !still;
  const drawing = mode !== "move" && !still;
  const runs = still ? [] : stepRuns(state);
  const bending = runs.find((run) => run.id === selectedId);

  function pitchAt(event: PointerEvent): PitchPoint {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return { x: 0, y: 0 };
    return clientToPitch(event.clientX, event.clientY, box, orientation);
  }

  function onPointerDown(event: PointerEvent<SVGSVGElement>): void {
    if (event.button !== 0 || gesture.current || still) return;
    const at = pitchAt(event);
    const target = event.target as Element;

    if (drawing) {
      gesture.current = { kind: "draw", pointerId: event.pointerId };
      capture(event);
      dispatch({ type: "lineBegin", at });
      return;
    }

    const tokenId = target
      .closest("[data-token-id]")
      ?.getAttribute("data-token-id");
    if (bending && target.closest("[data-bend-id]")) {
      gesture.current = {
        kind: "bend",
        pointerId: event.pointerId,
        id: bending.id,
        offset: { x: bending.mid.x - at.x, y: bending.mid.y - at.y },
      };
      capture(event);
      dispatch({ type: "grab", id: bending.id });
      return;
    }
    const token = frame.tokens.find((candidate) => candidate.id === tokenId);
    if (token) {
      gesture.current = {
        kind: "drag",
        pointerId: event.pointerId,
        id: token.id,
        offset: { x: token.x - at.x, y: token.y - at.y },
      };
      capture(event);
      dispatch({ type: "grab", id: token.id });
      return;
    }
    const lineId = target
      .closest("[data-line-id]")
      ?.getAttribute("data-line-id");
    dispatch({ type: "select", id: lineId ?? null });
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>): void {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const at = pitchAt(event);
    if (current.kind === "draw") {
      dispatch({ type: "lineExtend", at });
      return;
    }
    const to = { x: at.x + current.offset.x, y: at.y + current.offset.y };
    if (current.kind === "bend")
      dispatch({ type: "bend", id: current.id, via: to });
    else dispatch({ type: "drag", id: current.id, to });
  }

  function onPointerUp(event: PointerEvent<SVGSVGElement>): void {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (current.kind === "draw") {
      dispatch({ type: "lineExtend", at: pitchAt(event) });
      dispatch({ type: "lineEnd" });
    }
  }

  function onPointerCancel(event: PointerEvent<SVGSVGElement>): void {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (current.kind === "draw") dispatch({ type: "lineCancel" });
  }

  function onBendKeyDown(event: KeyboardEvent, run: StepRun): void {
    const arrow = ARROW_KEYS[event.key];
    if (arrow) {
      event.preventDefault();
      const step = event.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
      const by = screenToPitchDelta(
        arrow[0] * step,
        arrow[1] * step,
        orientation,
      );
      dispatch({
        type: "bend",
        id: run.id,
        via: { x: run.mid.x + by.x, y: run.mid.y + by.y },
      });
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      dispatch({ type: "straighten", id: run.id });
    }
  }

  function onItemKeyDown(event: KeyboardEvent, id: string): void {
    const arrow = ARROW_KEYS[event.key];
    if (arrow && scene.tokens.some((token) => token.id === id)) {
      event.preventDefault();
      const step = event.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
      const by = screenToPitchDelta(
        arrow[0] * step,
        arrow[1] * step,
        orientation,
      );
      dispatch({ type: "nudge", id, by });
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      dispatch({ type: "remove", id });
    } else if (event.key === "Escape") {
      dispatch({ type: "select", id: null });
      (event.currentTarget as SVGElement).blur();
    }
  }

  return (
    <svg
      ref={svgRef}
      role="group"
      aria-label={tacticsContent.board.pitch}
      viewBox={`0 0 ${view.width} ${view.height}`}
      style={{
        aspectRatio: `${view.width} / ${view.height}`,
        // Keep the whole pitch on screen between the toolbar and the
        // playback controls: no wider than the viewport height (less room
        // for both), or the height of the container it fills, allows.
        maxWidth:
          fit === "container"
            ? `calc(100cqh * ${view.width / view.height})`
            : `calc((100dvh - var(--space-20) * 2) * ${view.width / view.height})`,
      }}
      className={cn(
        "mx-auto block h-auto w-full rounded-[var(--radius-md)] select-none",
        // Moving leaves vertical page scroll to a finger on the empty pitch
        // (a token itself is touch-none); drawing claims every touch.
        drawing ? "cursor-crosshair touch-none" : "touch-pan-y",
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <g transform={viewMatrix(orientation)}>
        <PitchMarkings />
        {frame.lines.map((line) => (
          <g
            key={line.id}
            data-line-id={line.id}
            tabIndex={moving ? 0 : -1}
            role="button"
            aria-label={describeLine(line, scene)}
            aria-pressed={line.id === selectedId}
            className={cn(
              "outline-none",
              moving ? "cursor-pointer" : "pointer-events-none",
            )}
            onFocus={() => dispatch({ type: "select", id: line.id })}
            onKeyDown={(event) => onItemKeyDown(event, line.id)}
          >
            <BoardLineShape line={line} selected={line.id === selectedId} />
            <path
              d={linePath(line)}
              className="fill-none stroke-transparent"
              strokeWidth={LINE_HIT_WIDTH}
            />
          </g>
        ))}
        {draft && <BoardLineShape line={draft} />}
        {runs.map((run) => (
          <RunTrail key={run.id} run={run} />
        ))}
        {frame.tokens.map((token) => (
          <TokenShape
            key={token.id}
            token={token}
            name={describeToken(token, roster)}
            selected={token.id === selectedId}
            interactive={moving}
            orientation={orientation}
            onFocus={() => dispatch({ type: "select", id: token.id })}
            onKeyDown={(event) => onItemKeyDown(event, token.id)}
          />
        ))}
        {bending && (
          <circle
            data-bend-id={bending.id}
            cx={bending.mid.x}
            cy={bending.mid.y}
            r={BEND_RADIUS}
            tabIndex={0}
            role="button"
            aria-label={tacticsContent.board.bend(
              describeToken(bending.token, roster),
            )}
            className="cursor-move touch-none fill-[var(--board-selected)] stroke-[var(--board-edge)] outline-none focus-visible:stroke-[var(--board-marking)]"
            strokeWidth={0.15}
            onKeyDown={(event) => onBendKeyDown(event, bending)}
          />
        )}
      </g>
    </svg>
  );
}

/** A token's run in the step on show: where it starts and the path it takes. */
interface StepRun {
  readonly id: string;
  readonly token: BoardToken;
  readonly path: MovePath;
  /** The point the path passes halfway, where the bend handle sits. */
  readonly mid: PitchPoint;
}

/** The runs of the step the board rests on; none on the start arrangement. */
function stepRuns(state: BoardState): StepRun[] {
  const { scene, step } = state;
  if (step === 0) return [];
  const from = keyframePositions(scene, step - 1);
  return scene.tokens.flatMap((token) => {
    const move = moveIn(scene, step, token.id);
    const start = from.get(token.id);
    if (!move || !start) return [];
    const path = movePath(start, move);
    return [
      {
        id: token.id,
        token,
        path,
        mid: pointOnPath(path, 0.5),
      },
    ];
  });
}

/**
 * Where a run starts, as a hollow ring, and the dashed path to where the
 * token now stands.
 */
function RunTrail({ run }: { run: StepRun }) {
  const { start, control, end } = run.path;
  const radius = run.token.kind === "ball" ? BALL_RADIUS : PLAYER_RADIUS;
  return (
    <g aria-hidden className="pointer-events-none">
      <path
        d={`M${start.x} ${start.y}Q${control.x} ${control.y} ${end.x} ${end.y}`}
        className="fill-none stroke-[var(--board-trail)]"
        strokeWidth={TRAIL_WIDTH}
        strokeDasharray="0.6 0.5"
        strokeLinecap="round"
      />
      <circle
        cx={start.x}
        cy={start.y}
        r={radius}
        className="fill-none stroke-[var(--board-trail)]"
        strokeWidth={TRAIL_WIDTH}
        strokeDasharray="0.5 0.4"
      />
    </g>
  );
}

function TokenShape({
  token,
  name,
  selected,
  interactive,
  orientation,
  onFocus,
  onKeyDown,
}: {
  token: BoardToken;
  name: string;
  selected: boolean;
  interactive: boolean;
  orientation: Orientation;
  onFocus: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
}) {
  return (
    <g
      data-token-id={token.id}
      transform={`translate(${token.x} ${token.y})`}
      tabIndex={interactive ? 0 : -1}
      role="button"
      aria-label={name}
      aria-pressed={selected}
      className={cn(
        "outline-none",
        interactive ? "cursor-grab touch-none" : "pointer-events-none",
      )}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
    >
      <circle r={HIT_RADIUS} className="fill-transparent" />
      <TokenGlyph token={token} selected={selected} orientation={orientation} />
    </g>
  );
}
