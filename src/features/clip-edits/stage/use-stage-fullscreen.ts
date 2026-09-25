"use client";

/**
 * Fullscreen for the edited-clip stage: the picture, its overlays and the
 * transport together, never the bare `<video>` (whose native fullscreen would
 * drop the edit). Where the browser cannot put an element on the screen
 * (iPhone Safari), the stage fills the window instead, above the page, and
 * Escape or the same button takes it back (ADR 0011).
 */
import { type RefObject, useCallback, useEffect, useState } from "react";

import { useFullscreen } from "@/features/player/use-fullscreen";

export interface StageFullscreen {
  /** Whether the stage fills the screen, natively or in the page. */
  readonly isActive: boolean;
  /** Whether it fills the window in the page, as native fullscreen is missing. */
  readonly isInPage: boolean;
  readonly toggle: () => void;
}

export function useStageFullscreen(
  targetRef: RefObject<Element | null>,
): StageFullscreen {
  const native = useFullscreen(targetRef);
  const [isInPage, setIsInPage] = useState(false);

  useEffect(() => {
    if (!isInPage) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setIsInPage(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isInPage]);

  const { isSupported, toggle: toggleNative } = native;
  const toggle = useCallback(() => {
    if (isSupported) toggleNative();
    else setIsInPage((inPage) => !inPage);
  }, [isSupported, toggleNative]);

  return { isActive: native.isActive || isInPage, isInPage, toggle };
}
