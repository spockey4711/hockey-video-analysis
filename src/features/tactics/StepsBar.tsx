"use client";

/**
 * The animation controls under the board: playback (restart, step back,
 * play or pause, step forward, speed, and a scrubber over the whole
 * animation) and the steps themselves (pick one to edit, add one after it,
 * set its duration, delete it). The clock that drives playback lives here
 * too, so the board reducer stays a pure function of the time it is told.
 */
import { useEffect, useId, type Dispatch } from "react";

import {
  keyframeTimes,
  sceneDuration,
  STEP_DURATIONS,
  stepAtTime,
} from "./animation";
import type { BoardAction, BoardState } from "./board-state";
import { tacticsContent } from "./content";
import { MAX_STEPS } from "./scene";

import { cn } from "@/components/core/cn";
import { Button } from "@/components/forms/Button";
import { IconButton } from "@/components/forms/IconButton";
import { Select } from "@/components/forms/Select";
import { playerContent } from "@/features/player/content";
import {
  formatPlaybackRate,
  nextPlaybackRate,
} from "@/features/player/playback-rate";

const { steps: copy, playback: playCopy } = tacticsContent;

/**
 * Feed real time to the reducer while the animation plays, one tick per
 * animation frame. The first frame only takes the time, so a tab that was
 * hidden does not jump ahead by the whole pause.
 */
function usePlaybackClock(
  playing: boolean,
  dispatch: Dispatch<BoardAction>,
): void {
  useEffect(() => {
    if (!playing) return;
    let last: number | null = null;
    let frame = requestAnimationFrame(function tick(now) {
      if (last !== null)
        dispatch({ type: "tick", seconds: (now - last) / 1000 });
      last = now;
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing, dispatch]);
}

export function StepsBar({
  state,
  dispatch,
}: {
  state: BoardState;
  dispatch: Dispatch<BoardAction>;
}) {
  const { scene, playback, step } = state;
  const playing = playback?.playing ?? false;
  usePlaybackClock(playing, dispatch);

  const total = sceneDuration(scene);
  const times = keyframeTimes(scene);
  const time = playback?.time ?? times[step] ?? 0;
  const shown = playback ? stepAtTime(scene, playback.time) : step;
  const current = scene.steps[step - 1];
  const canPlay = total > 0;
  const durationId = useId();

  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      <div
        role="group"
        aria-label={playCopy.label}
        className="flex flex-wrap items-center gap-x-[var(--space-3)] gap-y-[var(--space-2)]"
      >
        <div className="flex items-center gap-[var(--space-1)]">
          <IconButton
            name="rotate-ccw"
            label={playCopy.restart}
            disabled={!canPlay}
            onClick={() => dispatch({ type: "restart" })}
          />
          <IconButton
            name="step-back"
            label={playCopy.back}
            disabled={!playback && step === 0}
            onClick={() => dispatch({ type: "stepBack" })}
          />
          <IconButton
            name={playing ? "pause" : "play"}
            label={playing ? playCopy.pause : playCopy.play}
            variant="accent"
            disabled={!canPlay}
            onClick={() => dispatch({ type: playing ? "pause" : "play" })}
          />
          <IconButton
            name="step-forward"
            label={playCopy.forward}
            disabled={!playback && step === scene.steps.length}
            onClick={() => dispatch({ type: "stepForward" })}
          />
          <SpeedButton
            speed={state.speed}
            onChange={(speed) => dispatch({ type: "setSpeed", speed })}
          />
        </div>
        <div className="flex min-w-[calc(var(--space-16)*3)] flex-1 items-center gap-[var(--space-3)]">
          <Scrubber
            time={time}
            total={total}
            keyframes={times}
            onSeek={(to) => dispatch({ type: "seek", time: to })}
          />
          <span className="shrink-0 font-[family-name:var(--font-mono)] text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)] tabular-nums">
            {playCopy.time(time, total)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-x-[var(--space-3)] gap-y-[var(--space-2)]">
        <div
          role="group"
          aria-label={copy.label}
          className="flex flex-wrap items-center gap-[var(--space-1)]"
        >
          {[0, ...scene.steps.map((_, index) => index + 1)].map((index) => (
            <button
              key={index}
              type="button"
              aria-pressed={!playback && index === step}
              aria-label={index === 0 ? copy.start : copy.step(index)}
              className={cn(
                "inline-flex h-[var(--control-md)] min-w-[var(--control-md)] items-center justify-center rounded-[var(--radius-md)] border px-[var(--space-2)] text-[length:var(--fs-body-sm)] tabular-nums transition duration-[var(--dur-fast)] ease-[var(--ease-out)] select-none focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none",
                index === shown
                  ? "border-[color:var(--border-focus)] bg-[var(--surface-hover)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]"
                  : "border-[color:var(--border)] text-[color:var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[color:var(--text-primary)]",
              )}
              onClick={() => dispatch({ type: "goToStep", step: index })}
            >
              {index === 0 ? copy.start : index}
            </button>
          ))}
          <IconButton
            name="plus"
            label={copy.add}
            disabled={scene.steps.length >= MAX_STEPS}
            onClick={() => dispatch({ type: "addStep" })}
          />
        </div>
        {current && !playback && (
          <div className="flex items-center gap-[var(--space-2)] sm:ml-auto">
            <label
              htmlFor={durationId}
              className="text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]"
            >
              {copy.duration}
            </label>
            <Select
              id={durationId}
              value={String(current.duration)}
              options={durationOptions(current.duration)}
              onChange={(event) =>
                dispatch({
                  type: "setDuration",
                  duration: Number(event.target.value),
                })
              }
            />
            <Button
              size="sm"
              variant="ghost"
              iconLeft="trash-2"
              className="text-[color:var(--danger)]"
              onClick={() => dispatch({ type: "removeStep" })}
            >
              {copy.remove}
            </Button>
          </div>
        )}
      </div>
      <p className="text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
        {copy.hint}
      </p>
    </div>
  );
}

/** The offered durations, plus a stored one off that list so it still shows. */
function durationOptions(current: number) {
  const values = STEP_DURATIONS.includes(current)
    ? STEP_DURATIONS
    : [...STEP_DURATIONS, current].sort((a, b) => a - b);
  return values.map((value) => ({
    value: String(value),
    label: copy.seconds(value),
  }));
}

/** Cycle the playback speed through the video player's ladder. */
function SpeedButton({
  speed,
  onChange,
}: {
  speed: number;
  onChange: (speed: number) => void;
}) {
  const upcoming = nextPlaybackRate(speed);
  const label = playerContent.transport.speed(formatPlaybackRate(upcoming));
  const offNormal = speed !== 1;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={offNormal}
      onClick={() => onChange(upcoming)}
      className={cn(
        "inline-flex h-[var(--control-md)] min-w-[var(--space-16)] items-center justify-center rounded-[var(--radius-md)] px-[var(--space-2)] font-[family-name:var(--font-mono)] text-[length:var(--fs-body-sm)] tabular-nums transition duration-[var(--dur-fast)] ease-[var(--ease-out)] select-none focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none",
        offNormal
          ? "bg-[var(--surface-hover)] text-[color:var(--text-brand)]"
          : "text-[color:var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[color:var(--text-primary)]",
      )}
    >
      {formatPlaybackRate(speed)}
    </button>
  );
}

/**
 * A track over the whole animation with a tick where each step arrives, and
 * a native range input over it for pointer and keyboard seeking.
 */
function Scrubber({
  time,
  total,
  keyframes,
  onSeek,
}: {
  time: number;
  total: number;
  keyframes: readonly number[];
  onSeek: (time: number) => void;
}) {
  const fraction = total > 0 ? Math.min(time / total, 1) : 0;
  return (
    <div className="relative flex h-[var(--space-5)] min-w-0 flex-1 items-center">
      <div className="absolute inset-x-0 h-[var(--space-2)] overflow-hidden rounded-[var(--radius-pill)] bg-[var(--surface-inset)]">
        <div
          className="absolute inset-y-0 left-0 rounded-[var(--radius-pill)] bg-[var(--accent)]"
          style={{ width: `${fraction * 100}%` }}
        />
        {total > 0 &&
          keyframes
            .slice(1, -1)
            .map((at) => (
              <span
                key={at}
                aria-hidden
                className="absolute inset-y-0 w-[var(--border-w-strong)] bg-[var(--border-strong)]"
                style={{ left: `${(at / total) * 100}%` }}
              />
            ))}
      </div>
      <input
        type="range"
        min={0}
        max={total}
        step={0.1}
        value={Math.min(time, total)}
        disabled={total === 0}
        aria-label={tacticsContent.playback.position}
        aria-valuetext={tacticsContent.playback.time(time, total)}
        onChange={(event) => onSeek(Number(event.target.value))}
        className={cn(
          "absolute inset-x-0 h-full w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-none disabled:cursor-not-allowed",
          // The handle in the design's colours rather than the browser's.
          "[&::-webkit-slider-thumb]:size-[var(--space-4)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--text-primary)]",
          "[&::-moz-range-thumb]:size-[var(--space-4)] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[var(--text-primary)]",
          "disabled:[&::-moz-range-thumb]:opacity-0 focus-visible:[&::-webkit-slider-thumb]:shadow-[var(--glow-turf)] disabled:[&::-webkit-slider-thumb]:opacity-0",
        )}
      />
    </div>
  );
}
