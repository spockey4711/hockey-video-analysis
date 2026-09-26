"use client";

import { useMemo, type ReactNode } from "react";

import { quarterClockS } from "./clock";
import type { Quarter } from "./navigation";

import { ClockFormatProvider, formatGameClock } from "@/features/player";

export interface QuarterClockProviderProps {
  /** Quarters already persisted for the game (empty when none set yet). */
  readonly quarters: readonly Quarter[];
  /** Nominal length of one period in the game's format, in seconds. */
  readonly periodLengthS: number;
  readonly children: ReactNode;
}

/**
 * Overrides the player's clock readouts to read match time (P1-4): the clock
 * starts at 0:00 at the first period and at one period length (15:00 in a
 * 4 x 15 game) at the second, ignoring the gaps between the marked periods.
 * Wraps the player so the transport, corner and top bar all pick it up via
 * {@link useClockFormat}. Built here as a client component because the
 * formatter is a function - it cannot cross the server/client boundary as a
 * page prop, so the page passes the serializable `quarters` and length instead.
 */
export function QuarterClockProvider({
  quarters,
  periodLengthS,
  children,
}: QuarterClockProviderProps) {
  const formatClock = useMemo(
    () => (gameTimeS: number) =>
      formatGameClock(quarterClockS(quarters, gameTimeS, periodLengthS)),
    [quarters, periodLengthS],
  );

  return (
    <ClockFormatProvider value={formatClock}>{children}</ClockFormatProvider>
  );
}
