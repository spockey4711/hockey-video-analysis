/**
 * German copy for the clip editor (ADR 0011), a coach-only surface. Kept in
 * one place per the repo's localization rule.
 */
export const clipEditorContent = {
  /** The page title and heading. */
  title: "Clip-Editor",
  /** Back link to the collection page, with its name. */
  back: (name: string) => `Sammlung "${name}"`,
  /** Opens the collection's share link in a new tab. */
  openLink: "Link ansehen",
  /** The save indicator in the header. */
  save: {
    saved: "Gespeichert",
    pending: "Wird gespeichert ...",
    error:
      "Speichern fehlgeschlagen - die nächste Änderung versucht es erneut.",
    conflict:
      "In einem anderen Tab geändert. Lade den Clip neu, bevor du weiterarbeitest.",
    reload: "Neu laden",
  },
  list: {
    heading: "Clips",
    /** An entry that plays differently from the plain clip. */
    edited: "bearbeitet",
    /** A player-specific clip, as in the collection's checklist. */
    single: "spielerbezogen",
    cutting: "wird geschnitten",
    failed: "Schnitt fehlgeschlagen",
  },
  /** Shown instead of the editor when the collection holds no clip. */
  empty: {
    title: "Noch keine Clips in dieser Sammlung",
    hint: 'Füge über "Clips hinzufügen" Clips hinzu, dann kannst du sie hier bearbeiten.',
  },
  /** Shown instead of the player while a clip is being cut. */
  cutting: {
    title: "Der Clip wird neu geschnitten",
    hint: "Das dauert meist nur ein paar Sekunden. Solange ist er auf keinem Link zu sehen.",
  },
  failed: {
    title: "Der Schnitt ist fehlgeschlagen",
    hint: "Kürze den Clip auf der Spielseite oder versuche es dort erneut.",
  },
  trim: {
    heading: "Länge",
    /** Accessible names of the two handles on the trim track. */
    inHandle: "Start des Clips",
    outHandle: "Ende des Clips",
    /** The readout under the track. */
    start: "Start",
    end: "Ende",
    length: "Länge",
    setIn: "Start hier setzen (I)",
    setOut: "Ende hier setzen (O)",
    inBack: "Start ein Bild früher",
    inForward: "Start ein Bild später",
    outBack: "Ende ein Bild früher",
    outForward: "Ende ein Bild später",
    reset: "Ganze Länge",
    /** The trim no longer fits the clip because it was shortened elsewhere. */
    clamped:
      "Der Clip wurde inzwischen gekürzt. Die Länge ist an den neuen Clip angepasst.",
    /** Before an approximate start: the clip's real start is not measured yet. */
    inexact:
      "Der genaue Anfang dieser Clip-Datei ist noch nicht gemessen, die Schnittpunkte können deshalb leicht abweichen.",
  },
  lengthen: {
    before: "Mehr Vorlauf (+2 s)",
    after: "Mehr Nachlauf (+2 s)",
    /** Why lengthening differs from shortening. */
    hint: "Mehr Vorlauf oder Nachlauf schneidet den Clip neu, für alle Links. Er ist dann ein paar Sekunden lang nirgends zu sehen.",
    failed:
      "Der Clip konnte nicht verlängert werden. Bitte versuche es erneut.",
  },
  /** The keys the editor listens to, shown under the tracks. */
  keys: "Leertaste: Abspielen - B / N: Einzelbild - I / O: Start / Ende setzen",
} as const;
