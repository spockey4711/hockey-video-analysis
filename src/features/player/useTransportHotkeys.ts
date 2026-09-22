"use client";

/**
 * Keyboard transport for the watch player (P2-7, P2-11): play/pause, coarse
 * skip, second and single-frame step, and speed control from slow motion to fast
 * scan, so a coach reaches and studies a moment without leaving the keyboard.
 * Mounted by {@link ContinuousPlayer}; it drives the shared
 * {@link PlayerController} and owns no time-mapping.
 *
 * Bindings (arrow-centric so they pair in the hint legend):
 * - Space         play / pause
 * - Left / Right  skip 10 s
 * - Shift+Arrow   step 1 s (pauses on a still frame)
 * - B / N         step one frame back / forward (pauses on a still frame)
 * - Up / Down     faster / slower (0.25x - 4x, slow motion below 1x)
 *
 * The `,` / `.` marker keys live in the jump-marker lane and `t`/`e`/`g`/`s`
 * capture tags, so `b`/`n` are picked to collide with neither - two adjacent
 * keys that read left-to-right as back and next.
 */
import { useEffect, useRef } from "react";

import type { PlayerController } from "./PlayerContext";
import { adjustPlaybackRate } from "./playback-rate";

/** Seconds skipped by the coarse rewind / fast-forward keys and buttons. */
export const SKIP_S = 10;
/** Seconds moved by a single second-step. */
export const STEP_S = 1;
/**
 * Seconds moved by a single-frame step. Chapter files carry no frame rate (the
 * schema stores only `duration_s`), so the step assumes the slowest rate a
 * recording plausibly has, 25 fps. On faster footage a press advances one or two
 * frames, which still reads as a frame step; a smaller value would land twice
 * inside the same frame on 25 fps material and look like a dead key.
 */
export const FRAME_S = 1 / 25;

/** Whether a keydown target is a text-entry surface we must not hijack. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function useTransportHotkeys(controller: PlayerController): void {
  // Keep the latest controller in a ref so the window listener binds once and
  // still reads fresh callbacks, avoiding a stale closure without re-subscribing.
  const latest = useRef(controller);
  useEffect(() => {
    latest.current = controller;
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.defaultPrevented || event.repeat) return;
      // Ctrl/Meta/Alt stay reserved for browser and OS shortcuts; Shift is a
      // transport modifier (fine step), so it is allowed through.
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;

      const c = latest.current;
      // Letter keys are matched case-insensitively so Caps Lock or a stray Shift
      // does not swallow a frame step.
      switch (event.key.length === 1 ? event.key.toLowerCase() : event.key) {
        case " ":
          c.togglePlay();
          break;
        case "ArrowLeft":
          if (event.shiftKey) c.stepBy(-STEP_S);
          else c.seekBy(-SKIP_S);
          break;
        case "ArrowRight":
          if (event.shiftKey) c.stepBy(STEP_S);
          else c.seekBy(SKIP_S);
          break;
        case "b":
          c.stepBy(-FRAME_S);
          break;
        case "n":
          c.stepBy(FRAME_S);
          break;
        case "ArrowUp":
          c.setPlaybackRate(adjustPlaybackRate(c.playbackRate, 1));
          break;
        case "ArrowDown":
          c.setPlaybackRate(adjustPlaybackRate(c.playbackRate, -1));
          break;
        default:
          return;
      }
      // Reached only for a handled key: claim it so the page does not also
      // scroll (Space, arrows) and marker keys stay unaffected.
      event.preventDefault();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
