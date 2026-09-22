"use client";

/**
 * Keyboard transport for the watch player (P2-7): play/pause, coarse skip, fine
 * frame/second step, and scan-speed control, so a coach reaches a moment fast
 * without leaving the keyboard. Mounted by {@link ContinuousPlayer}; it drives
 * the shared {@link PlayerController} and owns no time-mapping.
 *
 * Bindings (arrow-centric so they pair in the hint legend):
 * - Space         play / pause
 * - Left / Right  skip 10 s
 * - Shift+Arrow   step 1 s (pauses on a still frame)
 * - Up / Down     scan faster / slower (1x - 4x)
 * - F             enter / leave the fullscreen tagging stage
 *
 * The `,` / `.` marker keys live in the jump-marker lane; these keys are chosen
 * not to collide with those or the tag-capture letters.
 */
import { useEffect, useRef } from "react";

import type { PlayerController } from "./PlayerContext";
import { adjustPlaybackRate } from "./playback-rate";

/** Seconds skipped by the coarse rewind / fast-forward keys and buttons. */
export const SKIP_S = 10;
/** Seconds moved by a single frame/second step. */
export const STEP_S = 1;

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

export interface TransportHotkeyOptions {
  /**
   * Toggle the fullscreen tagging stage (bound to F). Omitted where there is no
   * stage to hand to the screen, and the key then stays unbound.
   */
  readonly onToggleFullscreen?: () => void;
}

export function useTransportHotkeys(
  controller: PlayerController,
  options: TransportHotkeyOptions = {},
): void {
  // Keep the latest controller and options in a ref so the window listener binds
  // once and still reads fresh callbacks, avoiding a stale closure without
  // re-subscribing.
  const latest = useRef({ controller, options });
  useEffect(() => {
    latest.current = { controller, options };
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.defaultPrevented || event.repeat) return;
      // Ctrl/Meta/Alt stay reserved for browser and OS shortcuts; Shift is a
      // transport modifier (fine step), so it is allowed through.
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;

      const { controller: c, options: o } = latest.current;
      // Letter keys are matched case-insensitively: Shift is a transport
      // modifier here, so Shift+F must not silently do nothing.
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
        case "ArrowUp":
          c.setPlaybackRate(adjustPlaybackRate(c.playbackRate, 1));
          break;
        case "ArrowDown":
          c.setPlaybackRate(adjustPlaybackRate(c.playbackRate, -1));
          break;
        case "f":
          if (!o.onToggleFullscreen) return;
          o.onToggleFullscreen();
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
