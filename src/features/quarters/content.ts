/**
 * User-facing copy for the quarter split (P1-4), kept in one place rather than
 * scattered as string literals across the components (per the repo's
 * localization rule). The audience is German-speaking coaches, so copy is
 * German ("Viertel" is the domain term for a quarter; see the design vocab).
 */
import type { QuarterDraftProblem } from "./draft";

export const quartersContent = {
  panelTitle: "Viertel",
  panelHint:
    "Setze Start und Ende an der aktuellen Spielzeit. Pausen zwischen den Vierteln werden beim Abspielen übersprungen.",
  /** Label for a single quarter row, e.g. "1. Viertel". */
  quarterLabel: (index: number): string => `${index}. Viertel`,
  /** Compact timeline label for a quarter band, e.g. "V1". */
  bandLabel: (index: number): string => `V${index}`,
  startColumn: "Start",
  endColumn: "Ende",
  /** Shown in a boundary cell that has not been marked yet. */
  unset: "Setzen",
  jump: (index: number): string => `Zum ${index}. Viertel springen`,
  setStart: (index: number): string =>
    `Start des ${index}. Viertels auf die aktuelle Spielzeit setzen`,
  setEnd: (index: number): string =>
    `Ende des ${index}. Viertels auf die aktuelle Spielzeit setzen`,
  clearEnd: (index: number): string => `Ende des ${index}. Viertels entfernen`,
  save: "Viertel speichern",
  saving: "Wird gespeichert ...",
  saved: "Viertel gespeichert.",
  problems: {
    gap: "Markiere die Viertel der Reihe nach, ohne eines auszulassen.",
    endBeforeStart: "Das Ende eines Viertels muss nach seinem Start liegen.",
    order: "Jedes Viertel muss nach dem vorherigen beginnen.",
    overlap: "Ein Viertel darf erst nach dem Ende des vorherigen beginnen.",
  } satisfies Record<QuarterDraftProblem, string>,
  errors: {
    save: "Die Viertel konnten nicht gespeichert werden.",
  },
} as const;
