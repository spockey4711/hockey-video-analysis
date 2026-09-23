"use client";

/**
 * Owns the telestration session (P2-10) for the watch player: the drawing model,
 * the rule that a drawing lives on exactly one still, and its keyboard bindings.
 *
 * Opening the layer pauses the game, so the coach always draws on a still. The
 * drawing belongs to that frame, so anything that moves the picture - playing
 * on, seeking, stepping a frame, a chapter swap - closes the layer and discards
 * the drawing; it would otherwise sit over a different moment than the one it
 * explains. The video element's own events are the signal, so every way of
 * moving (buttons, hotkeys, timeline, jump markers) is covered at once.
 *
 * Keys: `d` opens or closes the layer; while it is up, `Esc` closes it and
 * Ctrl/Cmd+Z takes back the last stroke. `d` collides with no transport, marker
 * or tag-capture key.
 */
import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type Dispatch,
  type RefObject,
} from "react";

import type { PlayerController } from "../PlayerContext";
import { isEditableTarget } from "../useTransportHotkeys";

import {
  initialTelestrationState,
  telestrationReducer,
  type TelestrationAction,
  type TelestrationState,
} from "./state";

export interface Telestration {
  readonly state: TelestrationState;
  readonly dispatch: Dispatch<TelestrationAction>;
  /** Pause on the current frame and put the drawing layer up. */
  readonly open: () => void;
  /** Take the layer down and discard the drawing. */
  readonly close: () => void;
  readonly toggle: () => void;
}

/** Video events that mean the picture under the drawing is about to change. */
const FRAME_LEAVING_EVENTS = ["play", "seeking", "emptied"] as const;

export function useTelestration(
  controller: PlayerController,
  videoRef: RefObject<HTMLVideoElement | null>,
): Telestration {
  const [state, dispatch] = useReducer(
    telestrationReducer,
    initialTelestrationState,
  );
  const { active } = state;
  const { pause } = controller;

  const open = useCallback(() => {
    pause();
    dispatch({ type: "open" });
  }, [pause]);
  const close = useCallback(() => dispatch({ type: "close" }), []);

  const latest = useRef({ active, open, close });
  useEffect(() => {
    latest.current = { active, open, close };
  });
  const toggle = useCallback(() => {
    const { active: isOpen, open: show, close: hide } = latest.current;
    if (isOpen) hide();
    else show();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!active || !video) return;
    for (const type of FRAME_LEAVING_EVENTS)
      video.addEventListener(type, close);
    return () => {
      for (const type of FRAME_LEAVING_EVENTS) {
        video.removeEventListener(type, close);
      }
    };
  }, [active, close, videoRef]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.defaultPrevented || event.repeat) return;
      if (isEditableTarget(event.target)) return;
      const isOpen = latest.current.active;
      const key = event.key.toLowerCase();

      if (event.ctrlKey || event.metaKey) {
        if (!isOpen || key !== "z" || event.shiftKey || event.altKey) return;
        dispatch({ type: "undo" });
      } else if (event.altKey) {
        return;
      } else if (key === "d") {
        toggle();
      } else if (isOpen && event.key === "Escape") {
        latest.current.close();
      } else {
        return;
      }
      event.preventDefault();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  return { state, dispatch, open, close, toggle };
}
