"use client";

/**
 * Skips the breaks between quarters during playback. Games are often recorded
 * uncut, so the footage between one quarter's marked end and the next quarter's
 * start is dead time: while the player is running and the playhead enters such
 * a break, this jumps straight to the next quarter's start. A paused playhead is
 * never moved, so the coach can still scrub or step into a break on purpose.
 *
 * Renders nothing; the watch page mounts it inside the player so it can read the
 * controller. The skip rule itself is the pure {@link breakSkipTargetS}.
 */
import { useEffect, useRef } from "react";

import { breakSkipTargetS, type Quarter } from "./navigation";

import { usePlayerController } from "@/features/player";

export interface QuarterBreakSkipProps {
  /** Quarters already persisted for the game (empty when none set yet). */
  readonly quarters: readonly Quarter[];
}

export function QuarterBreakSkip({ quarters }: QuarterBreakSkipProps) {
  const { gameTimeS, isPlaying, seekTo } = usePlayerController();
  // The jump already requested for the break the playhead is in. A seek into
  // another chapter file only lands once that file has loaded, and until then
  // the playhead still reads inside the break; this keeps the skip to one seek.
  const requestedTargetRef = useRef<number | null>(null);

  useEffect(() => {
    const targetS = isPlaying ? breakSkipTargetS(quarters, gameTimeS) : null;
    if (targetS === requestedTargetRef.current) return;
    requestedTargetRef.current = targetS;
    if (targetS !== null) seekTo(targetS);
  }, [quarters, gameTimeS, isPlaying, seekTo]);

  return null;
}
