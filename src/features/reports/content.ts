/**
 * User-facing copy for the game report (P2-12), kept in one place rather than
 * scattered as string literals (per the repo's localization rule). The audience
 * is German-speaking coaches, so copy is German. The CSV column and row labels
 * live here too: the export is user-facing output just like the page. Tag-type
 * labels are not repeated here; they come from the tag-type config (P1-3).
 */
import { quartersContent } from "@/features/quarters/content";

export const reportsContent = {
  title: "Spielbericht",
  subtitle: "Die Kennzahlen dieses Spiels, gezählt aus seinen Tags.",
  back: "Spiele",
  /** Secondary action back into the game's tagging workspace. */
  toTagging: "Zum Tagging",
  /** Primary action: download the figures as a CSV file. */
  download: "CSV exportieren",
  /** Shown instead of the figures while the game has no tags. */
  empty: {
    title: "Noch keine Tags",
    hint: "Tagge Momente im Tagging, dann erscheinen hier die Kennzahlen.",
  },
  loading: "Spielbericht wird geladen ...",
  figures: {
    heading: "Kennzahlen",
    total: "Tags gesamt",
  },
  quarters: {
    heading: "Nach Viertel",
    hint: "Welche Momente in welchem Viertel fielen.",
    /** Row label for one quarter, e.g. "1. Viertel" (the quarter lane's label). */
    row: quartersContent.quarterLabel,
    /** Row for tags before the first quarter or in a break. */
    outside: "Außerhalb der Viertel",
    /** Shown when the game has no quarters marked yet. */
    notSet:
      "Noch keine Viertel markiert. Setze sie im Tagging unter Viertel, dann siehst du hier die Aufteilung.",
  },
  players: {
    heading: "Nach Spieler",
    hint: "Ein Tag mit mehreren Spielern zählt bei jedem von ihnen.",
    /** Row for tags linked to no player. */
    unassigned: "Ohne Spieler",
    /** Compact jersey number prefix, e.g. "#7". */
    jersey: (n: number): string => `#${n}`,
  },
  table: {
    /** Header of the row-label column in the breakdown tables. */
    quarter: "Viertel",
    player: "Spieler",
    total: "Gesamt",
  },
  csv: {
    /** File-name stem; the date and game title follow it. */
    fileStem: "spielbericht",
    columns: {
      section: "Bereich",
      name: "Name",
      jersey: "Nr.",
      total: "Gesamt",
    },
    sections: {
      game: "Spiel",
      quarter: "Viertel",
      player: "Spieler",
    },
    /** Name cell of the whole-game row. */
    gameRow: "Gesamt",
  },
} as const;
