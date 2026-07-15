/**
 * User-facing copy for editing and deleting tags (P0-8), kept in one place
 * rather than scattered as string literals across the component (per the repo's
 * localization rule). The audience is German-speaking coaches, so copy is
 * German.
 */
export const tagEditContent = {
  panelTitle: "Erfasste Tags",
  panelHint: "Springe zu einem Moment, passe ihn an oder lösche ihn.",
  empty: "Noch keine Tags erfasst.",
  /** Screen-reader label for a row's time window, e.g. "Fenster 1:30 bis 1:45". */
  windowLabel: (start: string, end: string): string =>
    `Fenster ${start} bis ${end}`,
  /** Shown in place of an end time when the tag uses the type's default window. */
  defaultWindow: "Standardfenster",
  jump: "Springen",
  edit: "Bearbeiten",
  delete: "Löschen",
  save: "Speichern",
  saving: "Wird gespeichert ...",
  cancel: "Abbrechen",
  typeLabel: "Tag-Typ",
  setStart: "Start: Jetzt",
  setEnd: "Ende: Jetzt",
  clearEnd: "Ende zurücksetzen",
  confirmDelete: "Wirklich löschen?",
  confirmYes: "Ja, löschen",
  errors: {
    save: "Der Tag konnte nicht gespeichert werden.",
    delete: "Der Tag konnte nicht gelöscht werden.",
  },
} as const;
