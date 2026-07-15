/**
 * User-facing copy for the watch-page layout chrome (UX-6), kept in one place
 * rather than scattered as string literals (per the repo's localization rule).
 * The audience is German-speaking coaches, so copy is German. Feature-owned copy
 * (the tagging legend, player transport labels) stays in its own lane's content
 * module; this only covers the layout shell UX-6 owns.
 */
export const watchContent = {
  /** The immersive workspace's left icon rail (game-contextual navigation). */
  rail: {
    /** aria-label for the rail's nav landmark. */
    nav: "Bereiche",
    /** aria-label for the home monogram link. */
    home: "Zur Startseite",
    /** Back to the games list. */
    games: "Spiele",
    /** The current tagging workspace. */
    tagging: "Tagging",
    /** Share / collections surface. */
    share: "Teilen",
    /** aria-label for the signed-in coach avatar. */
    coach: (name: string) => `Angemeldet als ${name}`,
  },
  /** The right tags rail: the captured-tag list and the selected-tag detail. */
  tags: {
    /** Rail header; `count` is the number of captured tags. */
    title: "Tags",
    heading: (count: number) => `Tags . ${count}`,
    /** Shown in the list area when no tags are captured yet. */
    empty: {
      title: "Noch keine Tags",
      hint: "Drücke eine Tag-Taste, um den aktuellen Moment zu erfassen.",
    },
    /** Prompt in the detail area when no tag is selected. */
    selectHint: "Wähle einen Tag, um Details zu sehen.",
    /** Detail-panel field labels. */
    start: "Start",
    end: "Ende",
    /** Shown in place of an end time when the tag uses its type's default window. */
    defaultWindow: "Standard",
    /** Visibility field label in the detail panel. */
    visibility: "Sichtbarkeit",
    /** aria-label for selecting a tag row. */
    select: (label: string, at: string) => `${label} bei ${at} auswählen`,
  },
  /** The immersive workspace's top bar (title, chapter readout, primary action). */
  topbar: {
    /** Back link to the games list. */
    back: "Spiele",
    /** Chapter/position readout, e.g. "Kapitel 2/4". */
    chapter: (index: number, total: number) => `Kapitel ${index}/${total}`,
    /** Primary action: cut clips from every cut-eligible tag. */
    cut: "Clips schneiden",
    /** Primary action while enqueue requests are in flight. */
    cutting: "Wird eingereiht...",
  },
  /** The clip-board panel: enqueue a cut from a tag and watch its status (P2-1). */
  clips: {
    title: "Clips schneiden",
    hint: "Aus jedem Tag einen Clip schneiden und den Fortschritt verfolgen.",
    /** Shown when the game has no tags to cut clips from yet. */
    empty: {
      title: "Noch keine Tags",
      hint: "Tagge einen Moment, um einen Clip zu schneiden.",
    },
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
