"use client";

/**
 * Owns a telestration session (P2-10): the drawing model, the rule that a
 * drawing lives on exactly one still, and its keyboard bindings. The watch
 * player and presentation mode on the share links each run one over their own
 * video.
 *
 * Opening the layer pauses the game, so the coach always draws on a still. The
 * drawing belongs to that frame, so anything that moves the picture - playing
 * on, seeking, stepping a frame, a chapter swap - closes the layer and discards
 * the drawing; it would otherwise sit over a different moment than the one it
 * explains. The video element's own events are the signal, so every way of
 * moving (buttons, hotkeys, timeline, jump markers) is covered at once.
 *
 * Keys: `d` opens or closes the layer; while it is up, `Esc` closes it, `w`
 * steps through the stroke widths, `o` switches dotted lines on or off, `k`
 * picks the curved arrow and Ctrl/Cmd+Z takes back the last stroke. None of
 * these collides with a transport, marker, tag-capture or presentation key.
 *
 * The chosen stroke width is remembered in `localStorage`, so a coach who likes
 * thin lines does not have to pick them again on the next game.
 */
import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type Dispatch,
  type RefObject,
} from "react";

import { isEditableTarget } from "../useTransportHotkeys";

import {
  initialTelestrationState,
  isStrokeWidth,
  telestrationReducer,
  type Stroke,
  type TelestrationAction,
  type TelestrationState,
} from "./state";

export interface Telestration {
  readonly state: TelestrationState;
  readonly dispatch: Dispatch<TelestrationAction>;
  /** Pause on the current frame and put the drawing layer up. */
  readonly open: () => void;
  /** Pause and put the layer up holding `strokes`, a stored drawing to change. */
  readonly load: (strokes: readonly Stroke[]) => void;
  /** Take the layer down and discard the drawing. */
  readonly close: () => void;
  readonly toggle: () => void;
}

/** `localStorage` key holding the coach's last stroke width. */
export const STROKE_WIDTH_STORAGE_KEY = "hva-telestration-width";

/**
 * The starting state, with the stroke width the coach last picked. Only the
 * width is restored: nothing of it renders before the layer opens, so the
 * server render and hydration still agree.
 */
function initState(): TelestrationState {
  try {
    const stored = window.localStorage.getItem(STROKE_WIDTH_STORAGE_KEY);
    if (isStrokeWidth(stored)) {
      return { ...initialTelestrationState, width: stored };
    }
  } catch {
    /* No window (server render) or blocked storage: start from the default. */
  }
  return initialTelestrationState;
}

/** Video events that mean the picture under the drawing is about to change. */
const FRAME_LEAVING_EVENTS = ["play", "seeking", "emptied"] as const;

/**
 * @param pause holds the picture still before the layer goes up; pass a stable
 *   callback, since a new one re-creates `open`.
 */
export function useTelestration(
  pause: () => void,
  videoRef: RefObject<HTMLVideoElement | null>,
): Telestration {
  const [state, dispatch] = useReducer(
    telestrationReducer,
    undefined,
    initState,
  );
  const { active, width } = state;

  const open = useCallback(() => {
    pause();
    dispatch({ type: "open" });
  }, [pause]);
  const load = useCallback(
    (strokes: readonly Stroke[]) => {
      pause();
      dispatch({ type: "load", strokes });
    },
    [pause],
  );
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
    try {
      window.localStorage.setItem(STROKE_WIDTH_STORAGE_KEY, width);
    } catch {
      /* Private-mode or blocked storage: the width still holds for this page. */
    }
  }, [width]);

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
      } else if (isOpen && key === "w") {
        dispatch({ type: "cycleWidth" });
      } else if (isOpen && key === "o") {
        dispatch({ type: "toggleLineStyle" });
      } else if (isOpen && key === "k") {
        dispatch({ type: "setTool", tool: "curve" });
      } else {
        return;
      }
      event.preventDefault();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  return { state, dispatch, open, load, close, toggle };
}
