/**
 * User-facing copy for the games flow, kept in one place rather than scattered
 * as string literals across components (per the repo's localization rule). The
 * app's audience is German-speaking coaches, so copy is German.
 */
export const gamesContent = {
  list: {
    title: "Spiele",
    subtitle:
      "Lege ein Spiel an und hänge seine Kapiteldateien in Reihenfolge an.",
    newGame: "Neues Spiel",
    empty: {
      title: "Noch keine Spiele",
      hint: "Lege dein erstes Spiel an und hänge seine Kapiteldateien an.",
    },
    loading: "Spiele werden geladen ...",
    sourceCount: (n: number) => (n === 1 ? "1 Kapitel" : `${n} Kapitel`),
    noSources: "Keine Kapitel",
    // Shown for an imported game the coach has not reviewed yet.
    unnamed: "Unbenanntes Spiel",
  },
  incoming: {
    heading: "Neu eingegangen",
    hint: "Automatisch importierte Spiele. Prüfe Datum und Kapitel, gib Titel und Gegner ein und übernimm sie in deine Spiele.",
    open: "Prüfen",
    dateMissing: "Datum fehlt",
  },
  review: {
    title: "Spiel prüfen",
    subtitle:
      "Dieses Spiel wurde automatisch aus den abgelegten Dateien angelegt. Prüfe Datum und Kapitel, gib Titel und Gegner ein und übernimm es.",
    chaptersHeading: "Kapitel",
    chaptersTotal: (n: number, duration: string) =>
      `${n === 1 ? "1 Kapitel" : `${n} Kapitel`} · ${duration}`,
    dateMissingHint:
      "Für diese Aufnahme war kein verlässliches Datum lesbar. Bitte trage es ein.",
    titleLabel: "Titel",
    titlePlaceholder: "z. B. Heim vs. Rot-Weiss",
    opponentLabel: "Gegner",
    opponentPlaceholder: "Optional",
    playedOnLabel: "Datum",
    accept: "Übernehmen",
    accepting: "Wird übernommen ...",
    cancel: "Abbrechen",
    discard: "Spiel verwerfen",
    discardConfirm:
      "Das Spiel und seine Kapitelverweise werden gelöscht. Die Videodateien selbst bleiben unverändert.",
    discardYes: "Endgültig verwerfen",
    discarding: "Wird verworfen ...",
  },
  create: {
    title: "Neues Spiel",
    subtitle:
      "Titel, Datum und Gegner eingeben, dann die Videodateien in Reihenfolge verweisen.",
    titleLabel: "Titel",
    titlePlaceholder: "z. B. Heim vs. Rot-Weiss",
    opponentLabel: "Gegner",
    opponentPlaceholder: "Optional",
    playedOnLabel: "Datum",
    sourcesHeading: "Kapiteldateien",
    sourcesHint:
      "Die Dateien liegen bereits auf dem Server - hier wird nur ihr Pfad in Reihenfolge verwiesen, kein erneuter Upload. Die Dauer wird automatisch aus der Datei gelesen.",
    pathLabel: "Dateipfad",
    pathPlaceholder: "/media/2026-05-12-vs-rot-weiss/GX010123.MP4",
    durationLabel: "Dauer",
    durationPending: "Wird gelesen ...",
    durationEmpty: "-",
    durationUnreadable:
      "Datei nicht gefunden oder nicht abspielbar. Prüfe den Pfad.",
    addSource: "Kapitel hinzufügen",
    removeSource: "Kapitel entfernen",
    submit: "Spiel anlegen",
    submitting: "Wird angelegt ...",
  },
  errors: {
    titleRequired: "Bitte gib einen Titel ein.",
    titleTooLong: "Der Titel ist zu lang.",
    opponentTooLong: "Der Gegnername ist zu lang.",
    playedOnInvalid: "Das ist kein gültiges Datum.",
    playedOnRequired: "Bitte gib das Datum des Spiels ein.",
    sourcesRequired: "Füge mindestens eine Kapiteldatei hinzu.",
    tooManySources: "Zu viele Kapiteldateien.",
    pathRequired: "Bitte gib einen Dateipfad ein.",
    pathTooLong: "Der Dateipfad ist zu lang.",
    durationRequired:
      "Die Dauer konnte nicht aus der Datei gelesen werden. Prüfe den Pfad.",
    durationInvalid:
      "Die Dauer konnte nicht aus der Datei gelesen werden. Prüfe den Pfad.",
    durationTooLong: "Die Dauer ist unrealistisch lang.",
    reviewGone:
      "Dieses Spiel wurde bereits übernommen oder verworfen. Lade die Seite neu.",
    unexpected: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
  },
} as const;
