/**
 * Per-type colour for a jump-marker tick, keyed to the same design tokens the
 * `TagChip` (DS-3) codes each tag type with (`--tag-*`, see
 * `docs/design/README.md`), so a marker on the timeline reads as the same colour
 * as its chip in the list. Kept as a tiny pure map (not inlined) so it is
 * testable and has a single fallback for an unknown/added type.
 */

/** CSS custom-property name for a tag type's colour, or the neutral fallback. */
export function markerColorVar(type: string): string {
  return MARKER_COLOR_VARS[type] ?? "--text-secondary";
}

const MARKER_COLOR_VARS: Record<string, string> = {
  goal: "--tag-tor",
  corner_short: "--tag-ecke",
  action_good: "--tag-gut",
  action_bad: "--tag-schlecht",
};
