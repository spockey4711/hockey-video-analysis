/**
 * User-facing copy for the coach-only roster surface (P1-6 UI), kept in one place
 * rather than scattered as string literals (per the repo's localization rule).
 * The audience is German-speaking coaches, so copy is German.
 */
export const rosterContent = {
  title: "Kader",
  subtitle: "Freigabelinks zurücksetzen und Personen samt Daten löschen.",
  /** Shown while the roster loads. */
  loading: "Kader wird geladen ...",
  /** Shown when no players have been added yet. */
  empty: "Noch keine Spielerinnen oder Spieler angelegt.",
  /** Prefix for a player's jersey number, e.g. "Nr. 7". */
  jerseyPrefix: "Nr.",
  /** Label above a player's secret share link. */
  shareLinkLabel: "Freigabelink",
  /** Copy-to-clipboard control and its confirmation. */
  copy: "Kopieren",
  copied: "Kopiert",
} as const;
