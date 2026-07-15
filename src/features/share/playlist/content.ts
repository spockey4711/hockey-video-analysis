/**
 * German copy for the shared playlist player. Kept in one place rather than as
 * scattered literals (per the repo's localization rule); the player is rendered
 * on the login-free share surface, so the copy stays neutral and never names the
 * coach.
 */
export const playlistContent = {
  /** Accessible name for the whole player region. */
  regionLabel: "Clip-Wiedergabeliste",
  /** Fallback shown when the browser cannot play the video source. */
  unsupported: "Dein Browser kann dieses Video nicht abspielen.",
  transport: {
    previous: "Vorheriger Clip",
    next: "Nächster Clip",
    play: "Abspielen",
    pause: "Pause",
  },
  playlist: {
    /** Heading above the clip list. */
    heading: "Clips",
  },
} as const;
