/**
 * User-facing copy for the watch-page layout chrome (UX-6), kept in one place
 * rather than scattered as string literals (per the repo's localization rule).
 * The audience is German-speaking coaches, so copy is German. Feature-owned copy
 * (the tagging legend, player transport labels) stays in its own lane's content
 * module; this only covers the layout shell UX-6 owns.
 */
export const watchContent = {
  /** The clip-board panel: enqueue a cut from a tag and watch its status (P2-1). */
  clips: {
    title: "Clips schneiden",
    hint: "Aus jedem Tag einen Clip schneiden und den Fortschritt verfolgen.",
    /** Shown when the game has no tags to cut clips from yet. */
    empty: "Noch keine Tags. Tagge einen Moment, um einen Clip zu schneiden.",
    /** Queue a fresh cut for a tag that has none. */
    create: "Clip schneiden",
    /** Re-queue after a failed cut. */
    retry: "Erneut schneiden",
    /** Button label while the enqueue request is in flight. */
    enqueuing: "Wird eingereiht...",
    /** Failed to enqueue a cut (network or server error). */
    error: "Clip konnte nicht eingereiht werden.",
  },
  /** The keyboard-hint reference panel beside the player. */
  hotkeys: {
    title: "Tastenkürzel",
    hint: "Fokus auf den Player, dann Taste drücken.",
    /** Group headings for the hint list. */
    groups: {
      tagging: "Momente taggen",
      timeline: "Wiedergabe",
    },
    /** Labels for the non-tagging playback affordances. */
    playPause: "Abspielen / Pausieren",
    seek: "10 Sekunden vor / zurück",
    step: "Eine Sekunde vor / zurück",
    speed: "Schneller / langsamer (2x / 4x)",
  },
} as const;
