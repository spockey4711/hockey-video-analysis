/**
 * German copy for the tactics board, coach-only like the rest of the coach
 * workspace. The line tool, colour and width names come from the telestration
 * copy where the board offers the same thing, so the two read alike.
 */
import type { BoardMode } from "./board-state";
import type { BuiltInStart, FormationKind } from "./formation";
import type { PitchView } from "./pitch";
import type { Team } from "./scene";

export const tacticsContent = {
  list: {
    title: "Taktiktafel",
    description:
      "Stelle Spielszenen auf dem Feld nach, zeichne Laufwege und Pässe ein und speichere sie für die Besprechung.",
    empty: {
      title: "Noch keine Szenen",
      hint: "Lege die erste an.",
    },
    updated: (date: string) => `Geändert am ${date}`,
  },
  create: {
    label: "Name der Szene",
    placeholder: "z. B. Ecke kurz Variante 2",
    submit: "Szene anlegen",
    /** The view choice; it cannot be changed once the scene exists. */
    view: "Ausschnitt",
    viewHint: "Lässt sich später nicht mehr ändern.",
    /** What the new scene starts from: a built-in start or a formation. */
    start: "Start",
    starts: {
      lineup: "Grundaufstellung 1-3-4-3",
      empty: "Leeres Feld",
      ball: "Nur der Ball",
      "corner-defence": "Kurze Ecke: wir verteidigen",
      "corner-attack": "Kurze Ecke: wir greifen an",
    } satisfies Record<BuiltInStart, string>,
    formation: (name: string, kind: string) => `${name} (${kind})`,
    startHint: "Die Szene startet mit einer Kopie der Formation.",
  },
  formations: {
    title: "Formationen",
    description:
      "Eigene Aufstellungen wie eure Abwehr. Eine neue Szene kann mit einer Kopie davon starten.",
    back: "Alle Szenen und Formationen",
    empty: {
      title: "Noch keine Formationen",
      hint: "Lege eine an oder speichere die Startaufstellung einer Szene als Formation.",
    },
    label: "Name der Formation",
    placeholder: "z. B. Benji-Abwehr",
    submit: "Formation anlegen",
    kind: "Art",
    kinds: {
      attack: "Angriff",
      defence: "Abwehr",
    } satisfies Record<FormationKind, string>,
    players: (players: Record<Team, number>) =>
      `${players.home} Heim, ${players.away} Gast`,
    confirmDelete: "Diese Formation wirklich löschen?",
    editorHint:
      "Stelle die Spieler auf ihre Startpositionen. Szenen, die schon mit dieser Formation gestartet sind, bleiben, wie sie sind.",
    keyboardHint:
      "Pfeiltasten verschieben die Auswahl um 0,5\u00a0m, mit Umschalt um 5\u00a0m. Entf löscht sie.",
    /** Saving a scene's start arrangement as a new formation. */
    fromScene: {
      open: "Als Formation speichern",
      hint: "Speichert die Startaufstellung ohne Linien und Schritte als neue Formation.",
      submit: "Formation speichern",
      saved: "Formation gespeichert.",
      show: "Formation öffnen",
    },
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
    /** How much of the pitch the scene shows, fixed when it was created. */
    view: "Ausschnitt des Spielfelds",
    views: {
      full: "Ganzes Feld",
      corner: "Kurze Ecke",
    } satisfies Record<PitchView, string>,
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
    clearStepLines: "Linien dieses Schritts löschen",
    teams: { home: "Heim", away: "Gast" } satisfies Record<Team, string>,
    ball: "Ball",
    line: (mode: string, index: number) => `${mode} ${index}`,
    /** The handle on a selected token's run. */
    bend: (token: string) => `Laufweg von ${token} biegen`,
    keyboardHint:
      // Non-breaking spaces keep each distance on one line.
      "Pfeiltasten verschieben die Auswahl um 0,5\u00a0m, mit Umschalt um 5\u00a0m. Entf löscht sie. Leertaste spielt ab oder hält an, B und N springen einen Schritt zurück oder vor.",
  },
  steps: {
    label: "Schritte der Animation",
    start: "Start",
    step: (index: number) => `Schritt ${index}`,
    add: "Schritt hinzufügen",
    remove: "Schritt löschen",
    duration: "Dauer",
    seconds: (value: number) => `${String(value).replace(".", ",")}\u00a0s`,
    hint: "Wähle einen Schritt und ziehe Spieler oder Ball an ihr Ziel. Linien, die du dabei zeichnest, erscheinen nur in diesem Schritt.",
  },
  playback: {
    label: "Wiedergabe",
    play: "Abspielen (Leertaste)",
    pause: "Anhalten (Leertaste)",
    restart: "Von vorn abspielen",
    back: "Schritt zurück (B)",
    forward: "Schritt vor (N)",
    position: "Zeitpunkt der Animation",
    time: (now: number, total: number) =>
      `${now.toFixed(1).replace(".", ",")} / ${total.toFixed(1).replace(".", ",")}\u00a0s`,
  },
  panel: {
    none: "Wähle einen Spieler, den Ball oder eine Linie aus, um sie zu bearbeiten",
    label: "Beschriftung",
    labelHint: "Nummer oder Kürzel, höchstens 4 Zeichen",
    roster: "Spieler aus dem Kader",
    rosterNone: "Kein Kaderspieler",
    remove: "Entfernen",
    run: (step: number) => `Laufweg in Schritt ${step}`,
    runHint:
      "Ziehe den gelben Punkt auf dem Laufweg, um ihn zu biegen (auch mit den Pfeiltasten).",
    straighten: "Gerade laufen",
    resetMove: "Bewegung entfernen",
  },
  /**
   * The board opened over presentation mode. It runs on the login-free
   * collection link too, so like the presentation copy it never names the
   * coach.
   */
  presentation: {
    /** Heading and accessible name of the board layer. */
    label: "Taktiktafel",
    /** The picker for what the board starts from. */
    source: "Tafel",
    lineup: "Grundaufstellung",
    empty: "Leeres Feld",
    loading: "Szene wird geladen ...",
    loadFailed: "Die Szene konnte nicht geladen werden.",
    /** Back to the clip the presentation was on. */
    close: "Zurück zur Präsentation (T)",
    hint: "Die Tafel wird hier nicht gespeichert. T oder Esc führt zurück zur Präsentation.",
  },
  errors: {
    unauthorized: "Bitte melde dich erneut an.",
    invalidId: "Diese Szene gibt es nicht.",
    invalidName: "Bitte gib einen Namen mit höchstens 120 Zeichen ein.",
    invalidScene:
      "Die Szene konnte nicht gelesen werden. Bitte lade die Seite neu.",
    notFound: "Diese Szene gibt es nicht mehr.",
    invalidView:
      "Bitte wähle, ob die Szene das ganze Feld oder die kurze Ecke zeigt.",
    viewLocked:
      "Der Ausschnitt einer Szene lässt sich nicht ändern. Bitte lade die Seite neu.",
    invalidStart: "Bitte wähle, womit die Szene startet.",
    invalidKind: "Bitte wähle, ob die Formation für Angriff oder Abwehr ist.",
    invalidFormation:
      "Die Formation konnte nicht gelesen werden. Bitte lade die Seite neu.",
    noPlayers: "Eine Formation braucht mindestens einen Spieler.",
    formationNotFound: "Diese Formation gibt es nicht mehr.",
    unexpected: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
  },
} as const;
