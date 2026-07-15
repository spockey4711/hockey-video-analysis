/**
 * User-facing copy for the watch player, kept in one place rather than scattered
 * as string literals (per the repo's localization rule). The audience is
 * German-speaking coaches, so copy is German.
 */
export const playerContent = {
  /** Accessible labels for the transport controls (icon-only buttons). */
  transport: {
    play: "Abspielen",
    pause: "Pausieren",
    rewind: "10 Sekunden zurück",
    forward: "10 Sekunden vor",
    stepBack: "Eine Sekunde zurück",
    stepForward: "Eine Sekunde vor",
    /** Scan-speed control; `(rate)` names the speed it switches to on click. */
    speed: (rate: string) => `Wiedergabegeschwindigkeit: ${rate}`,
  },
  /** The game-time scrubber. */
  scrub: {
    label: "Spielzeit",
  },
  /** Player states surfaced to the coach. */
  status: {
    buffering: "Wird geladen ...",
    paused: "Pausiert",
    empty: {
      title: "Kein Videomaterial",
      hint: "Für dieses Spiel ist noch kein Video hinterlegt.",
    },
  },
  /** Watch page header. */
  header: {
    opponentPrefix: "gegen",
  },
  /** REC readout fallback when a chapter has no file name. */
  chapterFallback: (index: number) => `Kapitel ${index}`,
} as const;
