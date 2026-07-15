/**
 * User-facing copy for hotkey tagging, kept in one place rather than scattered
 * as string literals across the component (per the repo's localization rule).
 * The audience is German-speaking coaches, so copy is German.
 */
export const taggingContent = {
  legendTitle: "Tag-Tasten",
  legendHint: "Taste drücken, um den aktuellen Moment zu taggen.",
  /** Confirmation after a successful capture, e.g. "Tor bei 12:04 getaggt". */
  captured: (label: string, at: string): string => `${label} bei ${at} getaggt`,
  errors: {
    capture: "Der Moment konnte nicht erfasst werden.",
    save: "Der Tag konnte nicht gespeichert werden.",
  },
} as const;
