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
    exit: "Präsentation beenden",
  },
  /** Position readout, e.g. "Clip 2 / 8". */
  counter: (position: number, total: number): string =>
    `Clip ${position} / ${total}`,
} as const;
