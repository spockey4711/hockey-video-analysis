"use client";

/**
 * A tactics scene played as a collection entry (ADR 0014): the pitch with the
 * scene drawn on it, read-only, and a clock the share-link players drive like
 * a clip. An animated scene runs through its steps on the slice 2 engine
 * (`frameAt`, ADR 0012); a still one shows its start arrangement for `holdS`
 * seconds. Either way it reports play, pause and its end as a video would, so
 * the players step on, stop or offer a replay the same as after a clip.
 */
import {
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";

import { BoardLineShape } from "./BoardLineShape";
import { PitchMarkings } from "./PitchMarkings";
import { TokenGlyph } from "./TokenGlyph";
import { frameAt, keyframe, sceneDuration } from "./animation";
import { boardLayout, viewMatrix, viewSize } from "./geometry";
import type { TacticsScene } from "./scene";
import { visibleFrame } from "./visibility";

import { cn } from "@/components/core/cn";

/** What a player can do with the scene on show, like with a video. */
export interface SceneControl {
  play(): void;
  pause(): void;
  togglePlay(): void;
  /** Start over from the beginning and play. */
  replay(): void;
}

export interface SceneStageProps {
  readonly scene: TacticsScene;
  /** How long a still scene stays up, in seconds. */
  readonly holdS: number;
  /** The accessible name of the drawing: the scene's name. */
  readonly title: string;
  readonly controlRef: RefObject<SceneControl | null>;
  /** The scene is on screen and can play; stands in for a clip's `onReady`. */
  readonly onReady?: () => void;
  readonly onPlay?: () => void;
  readonly onPause?: () => void;
  /** The animation or the hold has run out. */
  readonly onEnded?: () => void;
  /** The drawing surface, for a pointer or overlay on top of it. */
  readonly surfaceRef?: Ref<HTMLDivElement>;
  readonly className?: string;
  /** Drawn over the scene: a title card, the laser pointer. */
  readonly children?: ReactNode;
}

export function SceneStage({
  scene,
  holdS,
  title,
  controlRef,
  onReady,
  onPlay,
  onPause,
  onEnded,
  surfaceRef,
  className,
  children,
}: SceneStageProps) {
  const animated = scene.steps.length > 0;
  const duration = animated ? sceneDuration(scene) : holdS;
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timeRef = useRef(0);

  const reportEnd = useEffectEvent(() => onEnded?.());
  const reportReady = useEffectEvent(() => onReady?.());

  function start(from: number): void {
    timeRef.current = from;
    setTime(from);
    setPlaying(true);
    onPlay?.();
  }

  function pause(): void {
    if (!playing) return;
    setPlaying(false);
    onPause?.();
  }

  useImperativeHandle(controlRef, () => ({
    play: () => {
      if (!playing) start(timeRef.current >= duration ? 0 : timeRef.current);
    },
    pause,
    togglePlay: () => {
      if (playing) pause();
      else start(timeRef.current >= duration ? 0 : timeRef.current);
    },
    replay: () => start(0),
  }));

  useEffect(() => {
    reportReady();
  }, []);

  // Real time drives the clock one animation frame at a time; the first
  // frame only takes the time, so a hidden tab does not jump ahead.
  useEffect(() => {
    if (!playing) return;
    let last: number | null = null;
    let frame = requestAnimationFrame(function tick(now) {
      if (last !== null) {
        const next = Math.min(timeRef.current + (now - last) / 1000, duration);
        timeRef.current = next;
        setTime(next);
        if (next >= duration) {
          setPlaying(false);
          reportEnd();
          return;
        }
      }
      last = now;
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing, duration]);

  // The stage is a landscape video frame on every screen, so a short-corner
  // quarter lies with its goal at the top and the whole pitch as in the plan.
  const layout = boardLayout(scene.view, "landscape");
  const view = viewSize(layout);
  const shown = visibleFrame(
    animated ? frameAt(scene, time) : keyframe(scene, 0),
    layout.bounds,
  );
  const progress = duration > 0 ? Math.min(time / duration, 1) : 0;

  return (
    <div
      ref={surfaceRef}
      className={cn(
        "relative overflow-hidden bg-[var(--surface-inset)]",
        className,
      )}
    >
      <svg
        role="img"
        aria-label={title}
        viewBox={`0 0 ${view.width} ${view.height}`}
        className="absolute inset-0 size-full"
      >
        <g transform={viewMatrix(layout)}>
          <PitchMarkings />
          {shown.lines.map((line) => (
            <BoardLineShape key={line.id} line={line} />
          ))}
          {shown.tokens.map((token) => (
            <g key={token.id} transform={`translate(${token.x} ${token.y})`}>
              <TokenGlyph token={token} turn={layout.turn} />
            </g>
          ))}
        </g>
      </svg>
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[var(--space-1)] bg-[var(--video-scrim)]"
      >
        <div
          className="h-full bg-[var(--accent)]"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      {children}
    </div>
  );
}
