"use client";

/**
 * The tools above the board: move or draw (line, arrow, curved arrow), the
 * pen colour, width and dotted style shared with telestration, adding players
 * and the ball, undo and clearing the lines.
 */
import type { Dispatch } from "react";

import type { BoardAction, BoardMode, BoardState } from "./board-state";
import { tacticsContent } from "./content";

import type { IconName } from "@/components/core/Icon";
import { cn } from "@/components/core/cn";
import { Button } from "@/components/forms/Button";
import { IconButton } from "@/components/forms/IconButton";
import { telestrationContent } from "@/features/player/telestration/content";
import {
  PEN_COLORS,
  STROKE_WIDTHS,
  type PenColor,
  type StrokeWidth,
} from "@/features/player/telestration/state";

const MODES: readonly { mode: BoardMode; icon: IconName }[] = [
  { mode: "move", icon: "mouse-pointer-2" },
  { mode: "line", icon: "minus" },
  { mode: "arrow", icon: "arrow-up-right" },
  { mode: "curve", icon: "spline" },
];

/** Swatch fills, spelled out so Tailwind sees each `--draw-*` class. */
const SWATCH: Record<PenColor, string> = {
  red: "bg-[var(--draw-red)]",
  yellow: "bg-[var(--draw-yellow)]",
  blue: "bg-[var(--draw-blue)]",
  white: "bg-[var(--draw-white)]",
};

/** Width glyphs: a bar as thick as the step. */
const WIDTH_BAR: Record<StrokeWidth, string> = {
  thin: "h-[var(--border-w-strong)]",
  medium: "h-[var(--space-1)]",
  thick: "h-[calc(var(--space-1)*1.75)]",
};

function toggleClass(selected: boolean): string {
  return cn(
    "inline-flex size-[var(--control-md)] items-center justify-center rounded-[var(--radius-md)] transition duration-[var(--dur-fast)] ease-[var(--ease-out)] focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none",
    selected ? "bg-[var(--surface-hover)]" : "hover:bg-[var(--surface-hover)]",
  );
}

/** A run of related controls that wraps as one piece on a narrow screen. */
const GROUP = "flex items-center gap-[var(--space-1)]";

export function BoardToolbar({
  state,
  dispatch,
}: {
  state: BoardState;
  dispatch: Dispatch<BoardAction>;
}) {
  const { board } = tacticsContent;
  const hasBall = state.scene.tokens.some((token) => token.kind === "ball");
  // The width and dot glyphs sit on the page surface, not on the video, so
  // they take the text colour: a white pen would vanish in the light theme.
  const glyph = "bg-[var(--text-primary)]";

  return (
    <div
      role="toolbar"
      aria-label={board.toolbar}
      className="flex flex-wrap items-center gap-x-[var(--space-3)] gap-y-[var(--space-2)]"
    >
      <div className={GROUP}>
        {MODES.map(({ mode, icon }) => (
          <IconButton
            key={mode}
            name={icon}
            label={board.modes[mode]}
            active={state.mode === mode}
            onClick={() => dispatch({ type: "setMode", mode })}
          />
        ))}
      </div>
      <div className={GROUP}>
        {PEN_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={telestrationContent.color(
              telestrationContent.colors[color],
            )}
            title={telestrationContent.colors[color]}
            aria-pressed={state.color === color}
            className={toggleClass(state.color === color)}
            onClick={() => dispatch({ type: "setColor", color })}
          >
            <span
              aria-hidden
              className={cn(
                "size-[var(--space-4)] rounded-full border border-[color:var(--border-strong)]",
                SWATCH[color],
              )}
            />
          </button>
        ))}
      </div>
      <div className={GROUP}>
        {STROKE_WIDTHS.map((width) => (
          <button
            key={width}
            type="button"
            aria-label={telestrationContent.width(
              telestrationContent.widths[width],
            )}
            title={telestrationContent.widths[width]}
            aria-pressed={state.width === width}
            className={toggleClass(state.width === width)}
            onClick={() => dispatch({ type: "setWidth", width })}
          >
            <span
              aria-hidden
              className={cn(
                "w-[var(--space-4)] rounded-full",
                glyph,
                WIDTH_BAR[width],
              )}
            />
          </button>
        ))}
        <button
          type="button"
          aria-label={telestrationContent.dotted}
          title={telestrationContent.dotted}
          aria-pressed={state.lineStyle === "dotted"}
          className={toggleClass(state.lineStyle === "dotted")}
          onClick={() => dispatch({ type: "toggleLineStyle" })}
        >
          <span aria-hidden className="flex gap-[var(--space-1)]">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className={cn("size-[var(--space-1)] rounded-full", glyph)}
              />
            ))}
          </span>
        </button>
      </div>
      <div className={GROUP}>
        <IconButton
          name="undo-2"
          label={board.undo}
          disabled={state.past.length === 0 && !state.draft}
          onClick={() => dispatch({ type: "undo" })}
        />
        <IconButton
          name="trash-2"
          label={board.clearLines}
          disabled={state.scene.lines.length === 0}
          onClick={() => dispatch({ type: "clearLines" })}
        />
      </div>
      <div className="flex flex-wrap gap-[var(--space-2)] lg:ml-auto">
        <Button
          size="sm"
          variant="secondary"
          iconLeft="plus"
          aria-label={board.addHome}
          onClick={() => dispatch({ type: "addPlayer", team: "home" })}
        >
          {board.teams.home}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          iconLeft="plus"
          aria-label={board.addAway}
          onClick={() => dispatch({ type: "addPlayer", team: "away" })}
        >
          {board.teams.away}
        </Button>
        {!hasBall && (
          <Button
            size="sm"
            variant="secondary"
            iconLeft="plus"
            aria-label={board.addBall}
            onClick={() => dispatch({ type: "addBall" })}
          >
            {board.ball}
          </Button>
        )}
      </div>
    </div>
  );
}
