"use client";

import { createContext, useContext } from "react";

import { formatGameClock } from "./format-timecode";

/**
 * How the player renders its clock readouts (transport, video-frame corner, top
 * bar). The player itself only knows how to format the raw game-time offset
 * ({@link formatGameClock}); a sibling lane can override this to show a different
 * clock without the player depending on that lane. The quarter split (P1-4)
 * supplies a quarter-aware formatter so the clock reads match time.
 *
 * This is a plain function, not a serializable prop, so it is provided from a
 * client component (never passed across the server/client boundary from a page).
 */
export type ClockFormat = (gameTimeS: number) => string;

const ClockFormatContext = createContext<ClockFormat>(formatGameClock);

export const ClockFormatProvider = ClockFormatContext.Provider;

/**
 * The active clock formatter. Falls back to the raw {@link formatGameClock} when
 * no provider is mounted, so the player renders correctly on its own.
 */
export function useClockFormat(): ClockFormat {
  return useContext(ClockFormatContext);
}
