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
import type { PlaybackPlan } from "@/features/clip-edits/playback";
import type { TacticsScene } from "@/features/tactics/scene";

export interface PlaylistItem {
  readonly kind?: "clip";
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
  /**
   * How the clip plays on the collection link (ADR 0011): its in and out
   * point on the clip file's clock, from the coach's edit for the collection
   * or else the clip's tag window, built on the server. The players then show
   * it on the edited-clip stage with the app's own controls. Absent, the clip
   * plays whole with the browser's controls, as on the team and player links.
   */
  readonly plan?: PlaybackPlan;
  /**
   * The clip's frames per second, the size of a frame step on the edited-clip
   * stage (collection link only). Absent or null when unknown, and a step then
   * assumes the default rate.
   */
  readonly frameRate?: number | null;
}

/**
 * A tactics scene the coach placed in a collection (ADR 0014), played as its
 * own entry between the clips: an animated scene runs through its steps, a
 * still one stays up for `holdS` seconds. The scene carries only what drawing
 * it needs, no roster links.
 */
export interface ScenePlaylistItem {
  readonly kind: "scene";
  /** The collection entry's id, never the scene's own. */
  readonly id: string;
  /** The scene's name. */
  readonly title: string;
  /** What kind of entry it is, e.g. "Taktikszene - Animation, 4 s". */
  readonly subtitle: string;
  readonly scene: TacticsScene;
  /** How long a still scene stays up, in seconds. */
  readonly holdS: number;
}

/** One entry a share-link player plays: a clip, or a scene on the collection link. */
export type PlaylistEntry = PlaylistItem | ScenePlaylistItem;

/** The clip an entry is, or `null` for a scene. */
export function clipOf(entry: PlaylistEntry): PlaylistItem | null {
  return entry.kind === "scene" ? null : entry;
}
