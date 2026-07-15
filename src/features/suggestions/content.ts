/**
 * User-facing copy for whistle-suggestion review (P1-5), kept in one place
 * rather than scattered as string literals (per the repo's localization rule).
 * The audience is German-speaking coaches, so copy is German. A double-whistle
 * candidate is a "Torvorschlag" (goal suggestion) the coach confirms or rejects.
 */
export const suggestionsContent = {
  panelTitle: "Torvorschläge",
  panelHint:
    "Doppelpfiff-Kandidaten aus der Analyse. Prüfe die Stelle und bestätige oder verwirf sie - nichts wird automatisch übernommen.",
  jump: "Zur Stelle springen",
  confirm: "Als Tor bestätigen",
  reject: "Verwerfen",
  reviewing: "Wird übernommen ...",
  /** Shown for a candidate the coach already confirmed into a goal tag. */
  confirmed: "Als Tor bestätigt",
  /** Shown for a candidate the coach rejected. */
  rejected: "Verworfen",
  empty: "Keine Torvorschläge für dieses Spiel.",
  errors: {
    review: "Der Vorschlag konnte nicht übernommen werden.",
    conflict: "Dieser Vorschlag wurde bereits geprüft.",
  },
} as const;
