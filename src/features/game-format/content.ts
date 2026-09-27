/**
 * User-facing copy for the game format, kept in one place rather than
 * scattered as string literals (per the repo's localization rule). The
 * audience is German-speaking coaches, so copy is German.
 */
import type { GameFormat, GameFormatField, PeriodCount } from "./format";

/** The period count as a coach names it. */
const PERIOD_COUNT_LABEL: Readonly<Record<PeriodCount, string>> = {
  4: "4 Viertel",
  2: "2 Halbzeiten",
};

export const gameFormatContent = {
  /** A format in short, e.g. "4 x 15 Min.". */
  summary: (format: GameFormat): string =>
    `${format.periodCount} x ${Math.round(format.periodLengthS / 60)} Min.`,
  periodCountLabel: "Abschnitte",
  periodCountOption: (count: PeriodCount): string => PERIOD_COUNT_LABEL[count],
  periodLengthLabel: "Minuten je Abschnitt",
  problems: {
    periodCount: "Wähle 4 Viertel oder 2 Halbzeiten.",
    periodLengthMin: "Gib eine ganze Zahl von 1 bis 60 Minuten ein.",
  } satisfies Record<GameFormatField, string>,
  /** The team default on the settings page (Einstellungen > Spiel). */
  team: {
    title: "Spiel",
    description:
      "Das Spielformat, mit dem neue Spiele starten. Ein einzelnes Spiel kann ein eigenes Format bekommen.",
    hint: "Spiele, in denen schon Abschnitte markiert sind, behalten ihr bisheriges Format.",
    submit: "Spielformat speichern",
    submitting: "Wird gespeichert ...",
    success: "Das Spielformat wurde gespeichert.",
  },
  /** A single game's format, on the new-game form and its settings. */
  game: {
    heading: "Spielformat",
    hint: "Bestimmt die Spieluhr und die Aufteilung im Spielbericht.",
    choiceLabel: "Format",
    teamOption: (format: GameFormat): string =>
      `Teamstandard (${gameFormatContent.summary(format)})`,
    customOption: "Eigenes Format",
    /**
     * Warns that saving removes the marked quarters past the new count. Only
     * quarters can be dropped: two halves are the fewest periods there are.
     */
    dropWarning: (firstDropped: number): string =>
      `Beim Speichern werden die Markierungen ab dem ${firstDropped}. Viertel entfernt.`,
    submit: "Spielformat speichern",
    submitting: "Wird gespeichert ...",
    success: "Das Spielformat wurde gespeichert.",
  },
  /** The game's settings page. */
  settings: {
    title: "Spieleinstellungen",
    back: "Zum Tagging",
  },
  errors: {
    unexpected: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
    gameGone: "Dieses Spiel gibt es nicht mehr.",
  },
} as const;
