/**
 * User-facing copy for the watch-page layout chrome (UX-6), kept in one place
 * rather than scattered as string literals (per the repo's localization rule).
 * The audience is German-speaking coaches, so copy is German. Feature-owned copy
 * (the tagging legend, player transport labels) stays in its own lane's content
 * module; this only covers the layout shell UX-6 owns.
 */
export const watchContent = {
  /** The keyboard-hint reference panel beside the player. */
  hotkeys: {
    title: "Tastenkürzel",
    hint: "Fokus auf den Player, dann Taste drücken.",
    /** Group headings for the hint list. */
    groups: {
      tagging: "Momente taggen",
      timeline: "Zeitleiste",
    },
    /** Labels for the non-tagging playback affordances. */
    seek: "Zeitleiste bewegen",
  },
} as const;
