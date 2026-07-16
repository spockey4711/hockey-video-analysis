"use client";

/**
 * Marker ticks drawn across the player's timeline track (P1-1). This fills the
 * player's `timelineOverlay` slot alongside the quarter bands; like them it is
 * purely visual and never intercepts pointer events, so the scrubber laid over
 * the same track keeps working. Tick positions come from the pure
 * {@link markerFraction} helper, and the total game length is read live from the
 * player controller (it comes from the video metadata, not the server render).
 */
import { usePlayerController } from "../PlayerContext";

import { markerColorVar } from "./marker-colors";
import { markerFraction, type JumpMarker } from "./navigation";

import { getTagType } from "@/lib/tag-types";

export interface JumpMarkerTrackProps {
  /** The game's tags as markers (empty when none captured yet). */
  readonly markers: readonly JumpMarker[];
}

export function JumpMarkerTrack({ markers }: JumpMarkerTrackProps) {
  const { durationS } = usePlayerController();
  if (markers.length === 0 || !(durationS > 0)) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {markers.map((marker) => (
        <span
          key={marker.id}
          title={getTagType(marker.type)?.label ?? marker.type}
          className="absolute inset-y-0 w-[2px] -translate-x-1/2 rounded-[var(--radius-pill)]"
          style={{
            left: `${markerFraction(marker.startS, durationS) * 100}%`,
            backgroundColor: `var(${markerColorVar(marker.type)})`,
          }}
        />
      ))}
    </div>
  );
}
