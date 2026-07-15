/**
 * User-facing copy for linking players to a tag and setting its visibility
 * (P0-7), kept in one place rather than scattered as string literals (per the
 * repo's localization rule). The audience is German-speaking coaches, so copy
 * is German ("Team-weit" vs. "Einzeln" is the design vocab for visibility).
 */
export const tagPlayersContent = {
  playersTitle: "Spieler",
  playersHint: "Wähle die beteiligten Spieler aus.",
  visibilityTitle: "Sichtbarkeit",
  visibilityTeam: "Team-weit",
  visibilitySingle: "Einzeln",
  save: "Speichern",
  saving: "Wird gespeichert ...",
  saved: "Gespeichert.",
  errors: {
    save: "Die Zuordnung konnte nicht gespeichert werden.",
  },
} as const;
