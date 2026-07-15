/**
 * Pure jump-marker navigation (P1-1, PRD Phase 1 s11 Option A) - no DB, no
 * framework, so it is unit-testable and shared by the timeline overlay and the
 * jump controls. A marker is a captured tag's start point on the global game
 * timeline (ADR 0002): every offset here is a global game-time offset in
 * seconds, never a file-local one.
 *
 * The point of this mode is that a coach can jump between tagged moments the
 * instant a game is loaded, without waiting for the clip-cutting pipeline - the
 * markers come straight from the `tags` table, not from cut clips.
 */

/** A tagged moment reduced to what jump navigation needs. */
export interface JumpMarker {
  /** The tag id, stable across renders and used as a React key. */
  readonly id: string;
  /** The tag-type key (P1-3), for labelling and colour coding. */
  readonly type: string;
  /** The marker's position on the global game timeline, in seconds. */
  readonly startS: number;
}

/**
 * Two markers within this many seconds of the current position count as "here",
 * so pressing next/previous while parked on a marker moves to the neighbour
 * rather than snapping back to the marker under the playhead. Small enough that
 * two genuinely distinct tags are never collapsed.
 */
const AT_MARKER_EPSILON_S = 0.25;

/** Return a copy of `markers` ordered by `startS`, so callers pass any order. */
export function sortMarkers(markers: readonly JumpMarker[]): JumpMarker[] {
  return [...markers].sort((a, b) => a.startS - b.startS);
}

/**
 * The first marker strictly after `gameTimeS`, or `null` when the playhead is at
 * or past the last marker. A marker within {@link AT_MARKER_EPSILON_S} of the
 * playhead is treated as the current one and skipped, so repeated presses always
 * advance.
 */
export function nextMarker(
  markers: readonly JumpMarker[],
  gameTimeS: number,
): JumpMarker | null {
  if (!Number.isFinite(gameTimeS)) return null;
  const sorted = sortMarkers(markers);
  return (
    sorted.find((marker) => marker.startS > gameTimeS + AT_MARKER_EPSILON_S) ??
    null
  );
}

/**
 * The last marker strictly before `gameTimeS`, or `null` when the playhead is at
 * or before the first marker. A marker within {@link AT_MARKER_EPSILON_S} of the
 * playhead is treated as the current one and skipped, so repeated presses always
 * step back.
 */
export function previousMarker(
  markers: readonly JumpMarker[],
  gameTimeS: number,
): JumpMarker | null {
  if (!Number.isFinite(gameTimeS)) return null;
  const sorted = sortMarkers(markers);
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if (sorted[i].startS < gameTimeS - AT_MARKER_EPSILON_S) return sorted[i];
  }
  return null;
}

/**
 * The marker the playhead is currently sitting on (within
 * {@link AT_MARKER_EPSILON_S}), or `null` when between markers. When two markers
 * are closer than the epsilon, the nearest to `gameTimeS` wins so the highlight
 * never flickers between them.
 */
export function activeMarker(
  markers: readonly JumpMarker[],
  gameTimeS: number,
): JumpMarker | null {
  if (!Number.isFinite(gameTimeS)) return null;
  let best: JumpMarker | null = null;
  let bestDistance = AT_MARKER_EPSILON_S;
  for (const marker of markers) {
    const distance = Math.abs(marker.startS - gameTimeS);
    if (distance <= bestDistance) {
      best = marker;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * A marker's position as a fraction of the whole game, for placing a tick on the
 * timeline. Clamped to `[0, 1]`; a non-positive total (duration not yet known
 * from the video metadata) yields `0` so a tick never renders off-track.
 */
export function markerFraction(startS: number, totalDurationS: number): number {
  if (!(totalDurationS > 0)) return 0;
  const fraction = startS / totalDurationS;
  if (!Number.isFinite(fraction)) return 0;
  return Math.min(Math.max(fraction, 0), 1);
}
