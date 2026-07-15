"use client";

/**
 * Connector that fills the player's `timelineOverlay` slot with quarter bands
 * (UX-4). {@link QuarterMarkers} is presentational and needs the game's total
 * length to place its bands, but that length is only known live - it comes from
 * the video metadata, not the server render. This bridge reads it from the
 * player controller and passes it through, so the page never has to guess a
 * duration. Mounted inside the player (ContinuousPlayer), where
 * {@link usePlayerController} is available. No quarter logic lives here.
 */
import { QuarterMarkers } from "../QuarterMarkers";
import type { Quarter } from "../navigation";

import { usePlayerController } from "@/features/player";

export interface QuarterTimelineOverlayProps {
  /** Quarters already persisted for the game (empty when none set yet). */
  readonly quarters: readonly Quarter[];
}

export function QuarterTimelineOverlay({
  quarters,
}: QuarterTimelineOverlayProps) {
  const { durationS } = usePlayerController();
  return <QuarterMarkers quarters={quarters} durationS={durationS} />;
}
