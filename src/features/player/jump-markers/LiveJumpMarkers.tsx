"use client";

/**
 * Live wiring for the jump markers (P1-1 follow-up). The pure {@link JumpMarkerNav}
 * and {@link JumpMarkerTrack} render whatever marker list they are handed; these
 * thin connectors feed them the markers derived from the shared live tag store
 * ({@link useGameTags}), so a moment tagged in-session appears on the timeline and
 * in the nav instantly - and an edit or delete moves or removes its marker -
 * without a page reload. A marker is just a tag reduced to what navigation needs.
 */
import { useMemo } from "react";

import { JumpMarkerNav } from "./JumpMarkerNav";
import { JumpMarkerTrack } from "./JumpMarkerTrack";
import type { JumpMarker } from "./navigation";

import { useGameTags } from "@/features/tagging/GameTagsProvider";

/** The live tag store projected to the fields jump navigation needs. */
function useGameMarkers(): JumpMarker[] {
  const { tags } = useGameTags();
  return useMemo(
    () => tags.map(({ id, type, startS }) => ({ id, type, startS })),
    [tags],
  );
}

/** Jump-marker sidebar nav bound to the live tag store. */
export function LiveJumpMarkerNav() {
  return <JumpMarkerNav markers={useGameMarkers()} />;
}

/** Timeline marker ticks bound to the live tag store. */
export function LiveJumpMarkerTrack() {
  return <JumpMarkerTrack markers={useGameMarkers()} />;
}
