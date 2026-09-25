/**
 * German copy for the tactics board, coach-only like the rest of the coach
 * workspace. The line tool, colour and width names come from the telestration
 * copy where the board offers the same thing, so the two read alike.
 */
import type { BoardMode } from "./board-state";
import type { Team } from "./scene";

export const tacticsContent = {
  list: {
    title: "Taktiktafel",
    description:
      "Stelle Spielszenen auf dem Feld nach, zeichne Laufwege und Pässe ein und speichere sie für die Besprechung.",
    empty: "Noch keine Szenen. Lege die erste an.",
    updated: (date: string) => `Geändert am ${date}`,
  },
  create: {
    label: "Name der Szene",
    placeholder: "z. B. Ecke kurz Variante 2",
    submit: "Szene anlegen",
  },
  editor: {
    back: "Alle Szenen",
    nameLabel: "Name der Szene",
    save: "Speichern",
    saving: "Wird gespeichert ...",
    saved: "Gespeichert",
    unsaved: "Ungespeicherte Änderungen",
    duplicate: "Duplizieren",
    delete: "Löschen",
    confirmDelete: "Diese Szene wirklich löschen?",
    confirmYes: "Endgültig löschen",
    cancel: "Abbrechen",
    copyName: (name: string) => `${name} (Kopie)`,
  },
  board: {
    /** Accessible name of the pitch. */
    pitch: "Spielfeld",
    toolbar: "Werkzeuge der Taktiktafel",
    modes: {
      move: "Bewegen",
      line: "Linie",
      arrow: "Pfeil",
      curve: "Kurvenpfeil",
    } satisfies Record<BoardMode, string>,
    addHome: "Heimspieler hinzufügen",
    addAway: "Gastspieler hinzufügen",
    addBall: "Ball hinzufügen",
    undo: "Rückgängig (Strg+Z)",
    clearLines: "Alle Linien löschen",
    teams: { home: "Heim", away: "Gast" } satisfies Record<Team, string>,
    ball: "Ball",
    line: (mode: string, index: number) => `${mode} ${index}`,
    keyboardHint:
      // Non-breaking spaces keep each distance on one line.
      "Pfeiltasten verschieben die Auswahl um 0,5\u00a0m, mit Umschalt um 5\u00a0m. Entf löscht sie.",
  },
  panel: {
    none: "Wähle einen Spieler, den Ball oder eine Linie aus, um sie zu bearbeiten.",
    label: "Beschriftung",
    labelHint: "Nummer oder Kürzel, höchstens 4 Zeichen",
    roster: "Spieler aus dem Kader",
    rosterNone: "Kein Kaderspieler",
    remove: "Entfernen",
  },
  errors: {
    unauthorized: "Bitte melde dich erneut an.",
    invalidId: "Diese Szene gibt es nicht.",
    invalidName: "Bitte gib einen Namen mit höchstens 120 Zeichen ein.",
    invalidScene:
      "Die Szene konnte nicht gelesen werden. Bitte lade die Seite neu.",
    notFound: "Diese Szene gibt es nicht mehr.",
    unexpected: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
  },
} as const;
