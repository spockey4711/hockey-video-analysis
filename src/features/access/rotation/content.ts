/**
 * User-facing copy for share-token rotation (P1-6), kept in one place rather
 * than scattered as string literals (per the repo's localization rule). The
 * audience is German-speaking coaches, so copy is German.
 */
export const rotationContent = {
  action: "Link zurücksetzen",
  running: "Wird zurückgesetzt ...",
  /** Warns that rotating revokes the currently shared link before it is done. */
  confirm: "Der bisherige Link wird dadurch ungültig. Wirklich zurücksetzen?",
  confirmYes: "Ja, Link zurücksetzen",
  cancel: "Abbrechen",
  success: "Neuer Link erstellt. Der alte Link funktioniert nicht mehr.",
  errors: {
    unauthorized: "Nur angemeldete Trainer können Links zurücksetzen.",
    invalidId: "Unbekannte Spielerin oder unbekannter Spieler.",
    notFound: "Spielerin oder Spieler nicht gefunden.",
    unexpected: "Der Link konnte nicht zurückgesetzt werden.",
  },
} as const;
