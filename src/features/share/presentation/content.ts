/**
 * German copy for the presentation mode (P1-8). Kept in one place rather than as
 * scattered literals (per the repo's localization rule); presentation mode runs
 * on the login-free share surface, so the copy stays neutral and never names the
 * coach.
 */
export const presentationContent = {
  /** Label of the button that opens the fullscreen presentation overlay. */
  launch: "Präsentationsmodus",
  /** Accessible name for the fullscreen overlay region. */
  regionLabel: "Präsentationsmodus",
  transport: {
    previous: "Vorheriger Clip",
    next: "Nächster Clip",
    play: "Abspielen",
    pause: "Pause",
    replay: "Nochmal abspielen",
    exit: "Präsentation beenden",
  },
  /** The toolbar switch and the `m` hotkey that show and hide the coach's markers. */
  marks: "Markierungen (M)",
  /** The toolbar switch and the `p` hotkey for the laser pointer dot. */
  pointer: "Laserpointer (P)",
  /**
   * The coach's private presenter notes. Only a signed-in coach ever gets this
   * panel, so unlike the rest of this copy it may address the coach.
   */
  notes: {
    /** The toolbar switch and the `h` hotkey that show and hide the panel. */
    toggle: "Notizen (H)",
    /** Heading and accessible name of the panel. */
    panelLabel: "Deine Notizen",
    collectionHeading: "Zur Sammlung",
    clipHeading: "Zu diesem Clip",
    /** Shown in the panel when the current clip has no note. */
    noClipNote: "Keine Notiz zu diesem Clip.",
  },
  /**
   * The title cards before a clip on the collection link, carrying the
   * coach's notes for the team; everyone with the link sees them.
   */
  titleCard: {
    /** Heading and accessible name of the collection intro card. */
    introLabel: "Einleitung",
    /** Heading and accessible name of a clip's card, above the clip's title. */
    clipLabel: "Vor dem Clip",
    /** Steps past the card: to the next card, or to the clip. */
    continue: "Weiter",
  },
  /** Position readout, e.g. "Clip 2 / 8". */
  counter: (position: number, total: number): string =>
    `Clip ${position} / ${total}`,
} as const;
