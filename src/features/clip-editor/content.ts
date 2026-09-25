/**
 * German copy for the clip editor (ADR 0011), a coach-only surface. Kept in
 * one place per the repo's localization rule.
 */

/** A zoom factor the German way, to one decimal: 2, 2,5. */
function formatFactor(factor: number): string {
  return String(Math.round(factor * 10) / 10).replace(".", ",");
}

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
  slow: {
    heading: "Zeitlupe",
    /** A slow-motion block on the track, e.g. "Zeitlupe 0,5x von 0:02,0 bis 0:04,0". */
    range: (rate: string, start: string, end: string) =>
      `Zeitlupe ${rate} von ${start} bis ${end}`,
    rates: { half: "0,5x", quarter: "0,25x" },
    /** Accessible names of the chosen block's handles and speed buttons. */
    startHandle: "Beginn der Zeitlupe",
    endHandle: "Ende der Zeitlupe",
    rate: "Tempo der Zeitlupe",
    add: "Zeitlupe ab hier",
    remove: "Zeitlupe entfernen",
    hint: "Ziehe auf der Spur über eine Stelle, um sie in Zeitlupe zu zeigen, und wähle das Tempo. Zeitlupe läuft ohne Ton.",
  },
  zoom: {
    heading: "Zoom",
    /** A keyframe on the track, by how far it zooms (the crop's width). */
    key: (w: number) =>
      w >= 1
        ? "Zoom-Punkt: ganzes Bild"
        : `Zoom-Punkt: ${formatFactor(1 / w)}-fach`,
    /** The crop frame on the picture. */
    frame: (w: number) =>
      w >= 1
        ? "Zoom-Ausschnitt: ganzes Bild"
        : `Zoom-Ausschnitt: ${formatFactor(1 / w)}-fach`,
    add: "Zoom hier setzen",
    /** How the picture gets to the next keyframe. */
    ease: "Bis zum nächsten Zoom-Punkt",
    eases: { hold: "Halten", glide: "Gleitend" },
    full: "Ganzes Bild",
    remove: "Zoom-Punkt entfernen",
    hint: "Setze einen Zoom-Punkt und ziehe auf dem Bild den Ausschnitt auf. Ein Punkt allein zoomt den ganzen Clip; von Punkt zu Punkt hält der Ausschnitt oder gleitet zum nächsten.",
    editing:
      "Ziehe den Rahmen auf dem Bild, an einer Ecke oder ganz neu auf. Pfeiltasten verschieben ihn, + und - zoomen. Abspielen zeigt den Zoom.",
  },
  marks: {
    heading: "Markierungen",
    /** A marker on the track, e.g. "Markierung bei 0:03,2, Bild hält an". */
    mark: (time: string, freeze: boolean) =>
      `Markierung bei ${time}, ${freeze ? "Bild hält an" : "läuft weiter"}`,
    add: "Markierung hinzufügen (D)",
    edit: "Zeichnung ändern",
    remove: "Markierung löschen",
    /** How long a marker shows, and the choices in seconds. */
    hold: "Dauer",
    seconds: (seconds: number) => `${String(seconds).replace(".", ",")} s`,
    /** What the picture does while the marker shows (D6). */
    mode: "Während der Markierung",
    modes: { freeze: "Bild anhalten", run: "Läuft weiter" },
    apply: "Übernehmen",
    cancel: "Abbrechen",
    /** Under the drawing tools while a marker is drawn. */
    drawing:
      'Zeichne Pfeile, Kreise und Linien auf das Bild. "Übernehmen" legt die Markierung an diese Stelle des Clips.',
    hint: "Halte an einer Stelle an und füge eine Markierung hinzu: Pfeile, Kreise und Linien. Sie hält das Bild ein paar Sekunden an oder zeigt sich über dem laufenden Video. Zuschauer können Markierungen ausblenden.",
    selected:
      '"Zeichnung ändern" öffnet die Zeichnung wieder, Dauer und Verhalten gelten sofort.',
  },
  /** The keys the editor listens to, shown under the tracks. */
  keys: "Leertaste: Abspielen - B / N: Einzelbild - I / O: Start / Ende setzen - D: Markierung zeichnen",
} as const;
