/**
 * User-facing copy for linking players to a tag and setting its visibility
 * (P0-7), kept in one place rather than scattered as string literals (per the
 * repo's localization rule). The audience is German-speaking coaches, so copy
 * is German ("Team-weit" vs. "Einzeln" is the design vocab for visibility).
 */
export const tagPlayersContent = {
  /** Button that opens the picker from a tag row. */
  manage: "Spieler",
  playersTitle: "Spieler",
  playersHint: "Wähle die beteiligten Spieler aus.",
  visibilityTitle: "Sichtbarkeit",
  visibilityTeam: "Team-weit",
  visibilitySingle: "Einzeln",
  /** Shown when the roster is empty, so no player can be picked yet. */
  emptyRoster: "Noch keine Spieler angelegt.",
  /** Guards the invariant that a `single` tag must name at least one player. */
  singleNeedsPlayer:
    "Ein einzelner Tag braucht mindestens einen Spieler, sonst ist der Clip über keinen Link erreichbar.",
  loading: "Wird geladen ...",
  save: "Speichern",
  saving: "Wird gespeichert ...",
  saved: "Gespeichert.",
  cancel: "Abbrechen",
  errors: {
    load: "Die Spieler konnten nicht geladen werden.",
    save: "Die Zuordnung konnte nicht gespeichert werden.",
  },
} as const;
