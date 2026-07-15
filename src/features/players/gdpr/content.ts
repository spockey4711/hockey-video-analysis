/**
 * User-facing copy for player erasure (P1-6), kept in one place rather than
 * scattered as string literals (per the repo's localization rule). The audience
 * is German-speaking coaches, so copy is German.
 */
export const gdprContent = {
  action: "Spieler löschen",
  running: "Wird gelöscht ...",
  /** Warns the delete is irreversible and takes the player's clips with it. */
  confirm:
    "Dies löscht die Person samt ihren eigenen Clips und Verknüpfungen. Das lässt sich nicht rückgängig machen. Wirklich löschen?",
  confirmYes: "Ja, endgültig löschen",
  cancel: "Abbrechen",
  success: "Person und zugehörige Daten wurden gelöscht.",
  errors: {
    unauthorized: "Nur angemeldete Trainer können Personen löschen.",
    invalidId: "Unbekannte Spielerin oder unbekannter Spieler.",
    notFound: "Spielerin oder Spieler nicht gefunden.",
    unexpected: "Die Person konnte nicht gelöscht werden.",
  },
} as const;
