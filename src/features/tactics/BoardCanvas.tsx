"use client";

/**
 * The board itself: the pitch as an SVG in metres, the lines on it and the
 * tokens on top. Pointer drags move tokens or draw lines (mouse, pen and
 * touch alike); a token or line takes keyboard focus, which selects it, and
 * the arrow keys nudge the selected token.
 */
import {
  useRef,
  type Dispatch,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import { BoardLineShape } from "./BoardLineShape";
import { PitchMarkings } from "./PitchMarkings";
import type { BoardAction, BoardState } from "./board-state";
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
import type { BoardToken, Team } from "./scene";

import { cn } from "@/components/core/cn";

/** Token sizes in metres: large enough to read, not to scale. */
const PLAYER_RADIUS = 1.2;
const BALL_RADIUS = 0.55;
/** The invisible circle around a token that catches a finger. */
const HIT_RADIUS = 2;
/** A line's invisible hit stroke, in metres. */
const LINE_HIT_WIDTH = 2;

/** Arrow-key nudge steps in metres: plain and with Shift. */
export const NUDGE_STEP = 0.5;
export const NUDGE_STEP_LARGE = 5;

const TEAM_FILL: Record<Team, string> = {
  home: "fill-[var(--board-home)]",
  away: "fill-[var(--board-away)]",
};
const TEAM_INK: Record<Team, string> = {
  home: "fill-[var(--board-home-ink)]",
  away: "fill-[var(--board-away-ink)]",
};

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
}

/** What the pointer is doing right now: dragging a token, or drawing a line. */
type Gesture =
  | { kind: "drag"; pointerId: number; id: string; offset: PitchPoint }
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
}: BoardCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const { scene, selectedId, mode, draft } = state;
  const view = viewSize(orientation);
  const moving = mode === "move";

  function pitchAt(event: PointerEvent): PitchPoint {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return { x: 0, y: 0 };
    return clientToPitch(event.clientX, event.clientY, box, orientation);
  }

  function onPointerDown(event: PointerEvent<SVGSVGElement>): void {
    if (event.button !== 0 || gesture.current) return;
    const at = pitchAt(event);
    const target = event.target as Element;

    if (!moving) {
      gesture.current = { kind: "draw", pointerId: event.pointerId };
      capture(event);
      dispatch({ type: "lineBegin", at });
      return;
    }

    const tokenId = target
      .closest("[data-token-id]")
      ?.getAttribute("data-token-id");
    const token = scene.tokens.find((candidate) => candidate.id === tokenId);
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
    } else {
      dispatch({
        type: "drag",
        id: current.id,
        to: { x: at.x + current.offset.x, y: at.y + current.offset.y },
      });
    }
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
        // Keep the whole pitch on screen under the toolbar: no wider than
        // the viewport height (less room for the toolbar) allows.
        maxWidth: `calc((100dvh - var(--space-20)) * ${view.width / view.height})`,
      }}
      className={cn(
        "mx-auto block h-auto w-full rounded-[var(--radius-md)] select-none",
        // Moving leaves vertical page scroll to a finger on the empty pitch
        // (a token itself is touch-none); drawing claims every touch.
        moving ? "touch-pan-y" : "cursor-crosshair touch-none",
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <g transform={viewMatrix(orientation)}>
        <PitchMarkings />
        {scene.lines.map((line) => (
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
        {scene.tokens.map((token) => (
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
      </g>
    </svg>
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
  const radius = token.kind === "ball" ? BALL_RADIUS : PLAYER_RADIUS;
  const label = token.kind === "player" ? token.label : "";
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
      {selected && (
        <circle
          r={radius + 0.5}
          className="fill-none stroke-[var(--board-selected)]"
          strokeWidth={0.3}
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
        strokeWidth={0.15}
      />
      {token.kind === "player" && label && (
        <text
          // The pitch is turned a quarter to the left in portrait; turn the
          // number back so it reads upright.
          transform={orientation === "portrait" ? "rotate(90)" : undefined}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={[...label].length > 2 ? 0.95 : 1.3}
          className={cn(
            "pointer-events-none [font-weight:var(--fw-bold)]",
            TEAM_INK[token.team],
          )}
        >
          {label}
        </text>
      )}
    </g>
  );
}
