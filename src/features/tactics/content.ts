/**
 * German copy for the tactics board, coach-only like the rest of the coach
 * workspace. The line tool, colour and width names come from the telestration
 * copy where the board offers the same thing, so the two read alike.
 */
import type { ImagePreset } from "./board-image";
import type { BoardMode } from "./board-state";
import type { BuiltInStart, FormationKind } from "./formation";
import type { SceneCategory } from "./library";
import type { ScreenFlip } from "./mirror";
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
    /** The scene list's filter and search (the set-play library). */
    filter: {
      heading: "Szenen filtern",
      search: "Suche",
      searchPlaceholder: "Name oder Stichwort",
      category: "Kategorie",
      view: "Ausschnitt",
      tag: "Stichwort",
      any: "Alle",
      apply: "Filtern",
      reset: "Zurücksetzen",
      count: (shown: number, total: number) =>
        shown === total
          ? `${total} ${total === 1 ? "Szene" : "Szenen"}`
          : `${shown} von ${total} Szenen`,
    },
    /** No scene passes the filter. */
    noMatch: {
      title: "Keine passenden Szenen",
      hint: "Ändere den Filter oder setze ihn zurück.",
    },
  },
  /** What a scene is about; one per scene. */
  categories: {
    attack_corner: "Ecke Angriff",
    defence_corner: "Ecke Abwehr",
    free_hit: "Freischlag",
    press: "Pressing",
    build_up: "Aufbau",
    other: "Sonstiges",
  } satisfies Record<SceneCategory, string>,
  /** The category and tag fields on the create form and in the editor. */
  grouping: {
    category: "Kategorie",
    tags: "Stichwörter",
    tagsPlaceholder: "z. B. Schlenzer, Variante 2",
    tagsHint: "Mit Komma trennen, höchstens 10.",
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
    placeholder: "z. B. Tiefe Abwehr",
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
      "Umschalt+Klick oder ein mit der Maus aufgezogener Rahmen wählt mehrere aus. Pfeiltasten verschieben die Auswahl um 0,5\u00a0m, mit Umschalt um 5\u00a0m. Entf löscht sie.",
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
  /** Renaming a scene or formation in place, in its editor title or list row. */
  rename: {
    open: "Umbenennen",
    scene: (name: string) => `Szene „${name}“ umbenennen`,
    formation: (name: string) => `Formation „${name}“ umbenennen`,
    save: "Namen speichern",
    saving: "Wird gespeichert ...",
    cancel: "Abbrechen",
    hint: "Enter speichert, Esc bricht ab.",
  },
  /** The coach's private coaching points for a scene. */
  notes: {
    heading: "Coaching-Punkte",
    hint: "Nur für dich: Sie werden mit der Szene gespeichert, erscheinen aber nie auf einem Link, in der Präsentation oder auf dem Beamer.",
    label: "Coaching-Punkte zur Szene",
    placeholder:
      "Worauf achten wir? Zum Beispiel: Blick vor der Annahme, Laufweg früh ansagen.",
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
    /** Show the roster names under the discs, on the coach's board only. */
    showNames: "Namen anzeigen",
    modes: {
      move: "Bewegen",
      line: "Linie",
      arrow: "Pfeil",
      curve: "Kurvenpfeil",
      run: "Lauf",
      pass: "Pass",
      dribble: "Dribbling",
      block: "Sperre",
      rect: "Rechteck",
      ellipse: "Ellipse",
      polygon: "Freie Fläche",
      text: "Text",
    } satisfies Record<BoardMode, string>,
    /** A tool's button: its name and the key that picks it. */
    tool: (mode: string, key: string) => `${mode} (${key.toUpperCase()})`,
    /** The play tools' key, naming what each line means on the board. */
    legend: "Legende",
    /** Why the dotted toggle is off while a play tool draws. */
    styleFixed: "Der Stil gehört zum Werkzeug",
    /** Why the dotted toggle is off while a zone or a text is put down. */
    styleLinesOnly: "Nur für Linien",
    /** The zone paint toggle: hatched instead of a see-through tint. */
    hatch: "Schraffiert (H)",
    hatchZonesOnly: "Nur für Flächen",
    /** What a new text says until the coach types their own. */
    newText: "Text",
    addHome: "Heimspieler hinzufügen",
    addAway: "Gastspieler hinzufügen",
    addBall: "Ball hinzufügen",
    undo: "Rückgängig (Strg+Z)",
    redo: "Wiederholen (Strg+Umschalt+Z)",
    copy: "Auswahl kopieren (Strg+C)",
    paste: "Einfügen (Strg+V)",
    /** Mirroring the scene, named by how the board flips on screen. */
    mirror: {
      horizontal: "Links und rechts spiegeln",
      vertical: "Oben und unten spiegeln",
    } satisfies Record<ScreenFlip, string>,
    clearLines: "Alles Gezeichnete löschen",
    clearStepLines: "Gezeichnetes dieses Schritts löschen",
    teams: { home: "Heim", away: "Gast" } satisfies Record<Team, string>,
    ball: "Ball",
    line: (mode: string, index: number) => `${mode} ${index}`,
    /** A text's accessible name: what it says. */
    text: (text: string) => `Text: ${text}`,
    /** The handle on a selected token's run. */
    bend: (token: string) => `Laufweg von ${token} biegen`,
    keyboardHint:
      // Non-breaking spaces keep each distance on one line.
      "Umschalt+Klick oder ein mit der Maus aufgezogener Rahmen wählt mehrere aus. Pfeiltasten verschieben die Auswahl um 0,5\u00a0m, mit Umschalt um 5\u00a0m. Entf löscht sie, Strg+C und Strg+V kopieren und fügen sie ein, auch in eine andere Szene. Leertaste spielt ab oder hält an, B und N springen einen Schritt zurück oder vor. V bewegt, L, P, D und S zeichnen Lauf, Pass, Dribbling und Sperre, R, E und F ein Rechteck, eine Ellipse und eine freie Fläche, H schraffiert sie. Mit Umschalt gezeichnet bleibt eine Linie gerade, in 45-Grad-Schritten.",
  },
  steps: {
    label: "Schritte der Animation",
    start: "Start",
    step: (index: number) => `Schritt ${index}`,
    add: "Schritt hinzufügen",
    remove: "Schritt löschen",
    duration: "Dauer",
    hold: "Halten",
    noHold: "Nicht halten",
    seconds: (value: number) => `${String(value).replace(".", ",")}\u00a0s`,
    /** The caption field, named after the step it captions. */
    caption: (step: number) =>
      step === 0 ? "Text zum Start" : `Text zu Schritt ${step}`,
    captionPlaceholder: "Zum Beispiel: Pass in die Tiefe auf die 9",
    captionHint:
      "Steht unter der Tafel, auf dem Link und in der Präsentation, solange der Schritt zu sehen ist.",
    hint: "Wähle einen Schritt und ziehe Spieler oder Ball an ihr Ziel. Linien, Flächen und Texte, die du dabei hinzufügst, erscheinen nur in diesem Schritt.",
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
  /** The board as a picture for a team chat (S7). */
  image: {
    open: "Als Bild",
    title: "Als Bild teilen",
    shape: "Format",
    presets: {
      wide: "16:9",
      standard: "4:3",
      square: "Quadrat",
    } satisfies Record<ImagePreset, string>,
    /** What the picture shows: the moment the board was on. */
    shows: {
      start: "Zeigt die Startaufstellung.",
      step: (step: number) => `Zeigt Schritt ${step}.`,
      moment: "Zeigt den Moment, an dem die Animation stand.",
    },
    privacy: "Spieler erscheinen nur mit ihrer Beschriftung, ohne Namen.",
    /** While the board shows names, the picture does too. */
    withNames:
      "Die Namen der Spieler sind im Bild zu sehen. Schalte „Namen anzeigen“ aus, um sie wegzulassen.",
    /** The picture's accessible name and the stem of its file name. */
    name: "Taktiktafel",
    preview: "Vorschau des Bildes",
    rendering: "Bild wird erstellt ...",
    failed: "Das Bild konnte nicht erstellt werden. Bitte versuche es erneut.",
    share: "Teilen",
    download: "Herunterladen",
    close: "Schließen",
  },
  panel: {
    none: "Wähle einen Spieler, den Ball, eine Linie, eine Fläche oder einen Text aus, um sie zu bearbeiten",
    label: "Beschriftung",
    labelHint: "Nummer oder Kürzel, höchstens 4 Zeichen",
    roster: "Spieler aus dem Kader",
    rosterNone: "Kein Kaderspieler",
    text: "Text",
    textHint: "Höchstens 40 Zeichen",
    bubble: "Als Sprechblase",
    position: "Position",
    positionHint: "Kürzel unter der Figur, z. B. TW, LV, IV",
    remove: "Entfernen",
    /** Several tokens and lines selected at once. */
    many: (count: number) => `${count} ausgewählt`,
    manyHint:
      "Ziehen oder die Pfeiltasten verschieben alle zusammen. Umschalt und Klick nimmt einzelne hinzu oder heraus.",
    removeAll: "Alle entfernen",
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
    invalidNotes:
      "Die Coaching-Punkte dürfen höchstens 1000 Zeichen lang sein.",
    notFound: "Diese Szene gibt es nicht mehr.",
    invalidView:
      "Bitte wähle, ob die Szene das ganze Feld oder die kurze Ecke zeigt.",
    viewLocked:
      "Der Ausschnitt einer Szene lässt sich nicht ändern. Bitte lade die Seite neu.",
    invalidStart: "Bitte wähle, womit die Szene startet.",
    invalidCategory: "Bitte wähle eine Kategorie.",
    invalidTags:
      "Bitte gib höchstens 10 Stichwörter mit je höchstens 30 Zeichen ein.",
    invalidKind: "Bitte wähle, ob die Formation für Angriff oder Abwehr ist.",
    invalidFormation:
      "Die Formation konnte nicht gelesen werden. Bitte lade die Seite neu.",
    noPlayers: "Eine Formation braucht mindestens einen Spieler.",
    formationNotFound: "Diese Formation gibt es nicht mehr.",
    unexpected: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
  },
} as const;
