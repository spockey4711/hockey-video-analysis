/**
 * The stable prop contract for the shared {@link PlaylistPlayer} (P0-10). Both
 * the team link (P0-10) and the per-player link (P0-11) map their own clip rows
 * to this shape, so the player itself stays view-agnostic: it knows nothing
 * about tags, players or visibility, only an ordered list of playable items.
 *
 * Every field is already display-ready. Building the label and resolving the
 * media URL happens server-side per view (see each view's `clip-items` mapper),
 * so the login-free client never sees a raw NAS path or a tag-type key.
 */
export interface PlaylistItem {
  /** Stable identity for keys and the active-item marker (the clip id). */
  readonly id: string;
  /** Resolved, loadable media URL for the `<video>` element. */
  readonly src: string;
  /** Primary label, e.g. the tag type in German ("Tor"). */
  readonly title: string;
  /** Secondary label, e.g. the game and timecode ("HTHC - Tor - 12:34"). */
  readonly subtitle?: string;
  /**
   * The coach's most recent highlighted comment on the clip, shown under the
   * title clamped to two lines (collection link only). Absent when the coach
   * has not commented, so the clip looks as before.
   */
  readonly coachComment?: string;
  /**
   * The coach's text for the team on this clip (collection link only): shown
   * in full under the title, and in presentation mode as a title card before
   * the clip plays. Absent when the coach wrote none, so the clip looks and
   * plays as before.
   */
  readonly teamNote?: string;
}
