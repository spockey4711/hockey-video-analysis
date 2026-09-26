/**
 * User-facing copy for the team's tag windows (Einstellungen > Tag-Fenster),
 * kept in one place rather than scattered as string literals (per the repo's
 * localization rule). The audience is German-speaking coaches, so copy is
 * German.
 */
import {
  MAX_POST_S,
  MAX_PRE_S,
  MIN_POST_S,
  MIN_PRE_S,
  type TagWindow,
} from "@/lib/tag-types";

export const tagWindowsContent = {
  title: "Tag-Fenster",
  description:
    "Wie viele Sekunden vor und nach dem Tag-Zeitpunkt ein neuer Clip umfasst. Gilt für neue Tags; bestehende Tags behalten ihr Fenster.",
  preLabel: "Vorlauf (s)",
  postLabel: "Nachlauf (s)",
  /** The type's built-in window, shown under its fields. */
  defaultHint: (window: TagWindow): string =>
    `Standard: ${window.preS} s / ${window.postS} s`,
  /** Names a field for screen readers, e.g. "Tor: Vorlauf (s)". */
  fieldName: (typeLabel: string, edgeLabel: string): string =>
    `${typeLabel}: ${edgeLabel}`,
  problems: {
    preS: `Ganze Sekunden von ${MIN_PRE_S} bis ${MAX_PRE_S}.`,
    postS: `Ganze Sekunden von ${MIN_POST_S} bis ${MAX_POST_S}.`,
    summary: "Bitte prüfe die markierten Felder.",
  },
  submit: "Tag-Fenster speichern",
  submitting: "Wird gespeichert ...",
  success: "Die Tag-Fenster wurden gespeichert.",
  reset: "Zurücksetzen",
  resetting: "Wird zurückgesetzt ...",
  resetHint: "Setzt alle Typen auf ihr Standardfenster zurück.",
  resetSuccess: "Alle Tag-Fenster stehen wieder auf dem Standard.",
  errors: {
    unexpected: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
  },
} as const;
