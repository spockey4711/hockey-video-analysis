/**
 * The configurable tag-type set (P1-3). This is the single edit point for which
 * moments a coach can tag and each type's default clip window. Adding, retuning,
 * or rebinding a type is a data change here - `tags.type` is free text, so there
 * is no migration, and the tagging UI reads this config rather than hard-coding
 * types, so there is no component change either (PRD 5.2).
 *
 * `key` is the stable value persisted in `tags.type`; `label` is German display
 * copy. Keeping both here keeps the type set and its localized labels in lockstep
 * in one place, per the repo's "no scattered string literals" rule.
 */

/** Default clip window around a capture point, in seconds. */
export interface TagWindow {
  /** Lead-in before the capture point: clip start = capture - `preS`. */
  readonly preS: number;
  /** Follow-through after the capture point: clip end = capture + `postS`. */
  readonly postS: number;
}

/** A tone alias (semantic color token) a type's chip or marker renders with. */
export type TagTone = "accent" | "success" | "warning" | "danger" | "info";

/** One taggable moment type and its capture defaults. */
export interface TagTypeDef {
  /** Stable key persisted in `tags.type`; never localized. */
  readonly key: string;
  /** German display label shown to the coach. */
  readonly label: string;
  /** Single lowercase key that captures this type via hotkey (no modifiers). */
  readonly hotkey: string;
  /** Semantic color token alias for the type's chip/marker. */
  readonly tone: TagTone;
  /** Default clip window applied on capture. */
  readonly window: TagWindow;
}

/**
 * The default type set for field-hockey tagging (PRD 5.2). Goals get a longer
 * lead-in to capture the build-up; the rest share a tighter window. Hotkeys are
 * mnemonic against the German labels (Tor, Ecke, Gut, Schlecht).
 */
export const TAG_TYPES = [
  {
    key: "goal",
    label: "Tor",
    hotkey: "t",
    tone: "success",
    window: { preS: 10, postS: 5 },
  },
  {
    key: "corner_short",
    label: "Ecke kurz",
    hotkey: "e",
    tone: "info",
    window: { preS: 8, postS: 6 },
  },
  {
    key: "action_good",
    label: "Aktion gut",
    hotkey: "g",
    tone: "accent",
    window: { preS: 8, postS: 4 },
  },
  {
    key: "action_bad",
    label: "Aktion schlecht",
    hotkey: "s",
    tone: "warning",
    window: { preS: 8, postS: 4 },
  },
] as const satisfies readonly TagTypeDef[];
