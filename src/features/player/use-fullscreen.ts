"use client";

/**
 * Binds the shared Fullscreen wrappers ({@link @/lib/fullscreen}) to one target
 * element, so the watch player can hand the video stage to the screen and get
 * the live state back (P2-16). The state is derived from `fullscreenchange`
 * rather than from our own calls, so leaving with Escape or the browser chrome
 * reconciles just as well as pressing the button.
 *
 * Support is probed in an effect, never during render: the server renders no
 * element, so a render-time probe would disagree with the first client render
 * and break hydration.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import {
  enterFullscreen,
  exitFullscreen,
  isFullscreenElement,
  isFullscreenSupported,
} from "@/lib/fullscreen";

/** Live fullscreen state for one target element, plus the controls to flip it. */
export interface Fullscreen {
  /** Whether the target element currently fills the screen. */
  readonly isActive: boolean;
  /** Whether this browser can put the target on the screen at all. */
  readonly isSupported: boolean;
  /** Enter fullscreen, or leave it when the target already owns the screen. */
  readonly toggle: () => void;
  /** Leave fullscreen; a no-op when the target is not on the screen. */
  readonly exit: () => void;
}

export function useFullscreen(
  targetRef: React.RefObject<Element | null>,
): Fullscreen {
  const [isActive, setIsActive] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  // The ref object itself is stable, but reading it during render is not; keep
  // the callbacks below dependent on nothing so they never re-subscribe.
  const ref = useRef(targetRef);
  useEffect(() => {
    ref.current = targetRef;
  });

  useEffect(() => {
    setIsSupported(isFullscreenSupported(ref.current.current));
  }, []);

  useEffect(() => {
    function onFullscreenChange(): void {
      setIsActive(isFullscreenElement(ref.current.current));
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggle = useCallback(() => {
    const target = ref.current.current;
    if (isFullscreenElement(target)) void exitFullscreen();
    else void enterFullscreen(target);
  }, []);

  const exit = useCallback(() => {
    if (isFullscreenElement(ref.current.current)) void exitFullscreen();
  }, []);

  return { isActive, isSupported, toggle, exit };
}
