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
  startLabel: "Start",
  endLabel: "Ende",
  lengthLabel: "Länge",
  /** Sets the edge to the playhead. */
  setNow: "Jetzt",
  /** Screen-reader labels for the edge buttons, e.g. "Start auf aktuelle Zeit". */
  setNowLabel: (edge: string): string => `${edge} auf aktuelle Zeit`,
  nudgeEarlierLabel: (edge: string): string => `${edge} 1 Sekunde früher`,
  nudgeLaterLabel: (edge: string): string => `${edge} 1 Sekunde später`,
  clearEnd: "Ende zurücksetzen",
  invalidWindow: "Das Ende muss nach dem Start liegen.",
  /** Shown while editing a tag whose clip is already cut or cutting. */
  recutHint:
    "Der Clip wird nach dem Speichern mit dem neuen Fenster neu geschnitten.",
  confirmDelete: "Wirklich löschen?",
  confirmYes: "Ja, löschen",
  errors: {
    save: "Der Tag konnte nicht gespeichert werden.",
    delete: "Der Tag konnte nicht gelöscht werden.",
  },
} as const;
