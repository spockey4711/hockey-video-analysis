/**
 * German copy for the edited-clip stage. It plays on the login-free collection
 * link as well as in the coach's editor, so the copy stays neutral and never
 * names the coach.
 */
export const stageContent = {
  /** Fallback shown when the browser cannot play the video source. */
  unsupported: "Dein Browser kann dieses Video nicht abspielen.",
  transport: {
    play: "Abspielen",
    pause: "Pause",
    frameBack: "Einzelbild zurück",
    frameForward: "Einzelbild vor",
    mute: "Ton aus",
    unmute: "Ton an",
    fullscreenEnter: "Vollbild",
    fullscreenExit: "Vollbild verlassen",
  },
  /** Accessible name of the scrub bar. */
  scrub: "Position im Clip",
  /** The clock beside the transport, e.g. "0:03,2 von 0:09,8" for a screen reader. */
  clockLabel: (position: string, length: string) => `${position} von ${length}`,
} as const;
