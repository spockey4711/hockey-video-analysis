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
    empty: "Noch keine Spiele. Lege dein erstes Spiel an.",
    loading: "Spiele werden geladen ...",
    sourceCount: (n: number) => (n === 1 ? "1 Kapitel" : `${n} Kapitel`),
    noSources: "Keine Kapitel",
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
      "Die Dateien liegen bereits auf dem NAS - hier wird nur ihr Pfad in Reihenfolge verwiesen, kein erneuter Upload.",
    pathLabel: "Dateipfad",
    pathPlaceholder: "/media/2026-05-12-vs-rot-weiss/GX010123.MP4",
    durationLabel: "Dauer (Sekunden)",
    durationPlaceholder: "z. B. 1218.4",
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
    sourcesRequired: "Füge mindestens eine Kapiteldatei hinzu.",
    tooManySources: "Zu viele Kapiteldateien.",
    pathRequired: "Bitte gib einen Dateipfad ein.",
    pathTooLong: "Der Dateipfad ist zu lang.",
    durationRequired: "Bitte gib die Dauer in Sekunden ein.",
    durationInvalid: "Die Dauer muss eine positive Zahl in Sekunden sein.",
    durationTooLong: "Die Dauer ist unrealistisch lang.",
    unexpected: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
  },
} as const;
