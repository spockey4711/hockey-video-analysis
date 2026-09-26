/**
 * User-facing copy for the period split (P1-4), kept in one place rather than
 * scattered as string literals across the components (per the repo's
 * localization rule). The audience is German-speaking coaches, so copy is
 * German. A game plays four quarters ("Viertel", neuter) or two halves
 * ("Halbzeit", feminine), and German inflects the article and ending with the
 * noun, so each format gets its own full wording rather than a noun spliced
 * into one template.
 */
import type { QuarterDraftProblem } from "./draft";

import type { PeriodCount } from "@/features/game-format/format";

/** The copy for one game format's periods. */
export interface PeriodsContent {
  /** The periods as a group, e.g. the editor's title "Viertel". */
  readonly panelTitle: string;
  readonly panelHint: string;
  /** Label for a single period row, e.g. "1. Viertel". */
  readonly quarterLabel: (index: number) => string;
  /** Compact timeline label for a period band, e.g. "V1". */
  readonly bandLabel: (index: number) => string;
  readonly startColumn: string;
  readonly endColumn: string;
  /** Shown in a boundary cell that has not been marked yet. */
  readonly unset: string;
  readonly jump: (index: number) => string;
  readonly setStart: (index: number) => string;
  readonly setEnd: (index: number) => string;
  readonly clearEnd: (index: number) => string;
  readonly save: string;
  readonly saving: string;
  readonly saved: string;
  readonly problems: Readonly<Record<QuarterDraftProblem, string>>;
  readonly errors: { readonly save: string };
}

const QUARTERS: PeriodsContent = {
  panelTitle: "Viertel",
  panelHint:
    "Setze Start und Ende an der aktuellen Spielzeit. Pausen zwischen den Vierteln werden beim Abspielen übersprungen.",
  quarterLabel: (index) => `${index}. Viertel`,
  bandLabel: (index) => `V${index}`,
  startColumn: "Start",
  endColumn: "Ende",
  unset: "Setzen",
  jump: (index) => `Zum ${index}. Viertel springen`,
  setStart: (index) =>
    `Start des ${index}. Viertels auf die aktuelle Spielzeit setzen`,
  setEnd: (index) =>
    `Ende des ${index}. Viertels auf die aktuelle Spielzeit setzen`,
  clearEnd: (index) => `Ende des ${index}. Viertels entfernen`,
  save: "Viertel speichern",
  saving: "Wird gespeichert ...",
  saved: "Viertel gespeichert.",
  problems: {
    gap: "Markiere die Viertel der Reihe nach, ohne eines auszulassen.",
    endBeforeStart: "Das Ende eines Viertels muss nach seinem Start liegen.",
    order: "Jedes Viertel muss nach dem vorherigen beginnen.",
    overlap: "Ein Viertel darf erst nach dem Ende des vorherigen beginnen.",
  },
  errors: {
    save: "Die Viertel konnten nicht gespeichert werden.",
  },
};

const HALVES: PeriodsContent = {
  panelTitle: "Halbzeiten",
  panelHint:
    "Setze Start und Ende an der aktuellen Spielzeit. Die Pause zwischen den Halbzeiten wird beim Abspielen übersprungen.",
  quarterLabel: (index) => `${index}. Halbzeit`,
  bandLabel: (index) => `H${index}`,
  startColumn: "Start",
  endColumn: "Ende",
  unset: "Setzen",
  jump: (index) => `Zur ${index}. Halbzeit springen`,
  setStart: (index) =>
    `Start der ${index}. Halbzeit auf die aktuelle Spielzeit setzen`,
  setEnd: (index) =>
    `Ende der ${index}. Halbzeit auf die aktuelle Spielzeit setzen`,
  clearEnd: (index) => `Ende der ${index}. Halbzeit entfernen`,
  save: "Halbzeiten speichern",
  saving: "Wird gespeichert ...",
  saved: "Halbzeiten gespeichert.",
  problems: {
    gap: "Markiere die Halbzeiten der Reihe nach, ohne eine auszulassen.",
    endBeforeStart: "Das Ende einer Halbzeit muss nach ihrem Start liegen.",
    order: "Die 2. Halbzeit muss nach der 1. beginnen.",
    overlap: "Die 2. Halbzeit darf erst nach dem Ende der 1. beginnen.",
  },
  errors: {
    save: "Die Halbzeiten konnten nicht gespeichert werden.",
  },
};

const BY_PERIOD_COUNT: Readonly<Record<PeriodCount, PeriodsContent>> = {
  4: QUARTERS,
  2: HALVES,
};

/** The period copy for a game playing `periodCount` periods. */
export function quartersContent(periodCount: PeriodCount): PeriodsContent {
  return BY_PERIOD_COUNT[periodCount];
}
