/**
 * User-facing copy for the quarter split (P1-4), kept in one place rather than
 * scattered as string literals across the components (per the repo's
 * localization rule). The audience is German-speaking coaches, so copy is
 * German ("Viertel" is the domain term for a quarter; see the design vocab).
 */
export const quartersContent = {
  panelTitle: "Viertel",
  panelHint: "Springe zum Beginn eines Viertels oder markiere die Grenzen.",
  /** Label for a single quarter row, e.g. "1. Viertel". */
  quarterLabel: (index: number): string => `${index}. Viertel`,
  jump: "Zum Viertel springen",
  setStart: "Start setzen",
  notSet: "Nicht gesetzt",
  save: "Viertel speichern",
  saving: "Wird gespeichert ...",
  saved: "Viertel gespeichert.",
  errors: {
    save: "Die Viertel konnten nicht gespeichert werden.",
  },
} as const;
