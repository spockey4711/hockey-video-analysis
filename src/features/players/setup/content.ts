/**
 * User-facing copy for setting up the roster (adding and editing players), kept
 * in one place rather than scattered as string literals (per the repo's
 * localization rule). The audience is German-speaking coaches, so copy is German.
 */
export const playerSetupContent = {
  /** The add-player card above the roster. */
  addHeading: "Spielerin oder Spieler hinzufügen",
  addHint:
    "Jede Person bekommt sofort einen eigenen Freigabelink für ihre Clips.",
  addAction: "Hinzufügen",
  adding: "Wird hinzugefügt ...",
  added: "Hinzugefügt. Der Freigabelink steht jetzt in der Liste.",
  /** Field labels and placeholders, shared by the add and edit forms. */
  nameLabel: "Name",
  namePlaceholder: "z. B. Alex Muster",
  jerseyLabel: "Rückennummer",
  jerseyPlaceholder: "optional",
  /** The per-row edit control. */
  editAction: "Bearbeiten",
  saveAction: "Speichern",
  saving: "Wird gespeichert ...",
  cancel: "Abbrechen",
  errors: {
    unauthorized: "Nur angemeldete Trainer können den Kader bearbeiten.",
    nameRequired: "Bitte einen Namen eingeben.",
    nameTooLong: "Der Name ist zu lang (höchstens 100 Zeichen).",
    jerseyInvalid: "Die Rückennummer muss eine Zahl von 1 bis 99 sein.",
    invalidId: "Unbekannte Spielerin oder unbekannter Spieler.",
    notFound: "Spielerin oder Spieler nicht gefunden.",
    unexpected: "Das hat nicht geklappt. Bitte erneut versuchen.",
  },
} as const;
