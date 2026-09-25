/**
 * German copy for picking clips into a collection (ADR 0011): the clip
 * editor's "Clips hinzufügen" picker and "Neue Sammlung", and the watch
 * page's "In Sammlung bearbeiten". Coach-only surfaces, kept in one place per
 * the repo's localization rule.
 */
export const pickerContent = {
  picker: {
    /** Opens the picker from the editor's header, and its dialog title. */
    open: "Clips hinzufügen",
    close: "Schließen",
    /** The three filters; the empty choice matches every clip. */
    game: "Spiel",
    tagType: "Art",
    player: "Spieler",
    all: "Alle",
    /** How many clips the filters leave. */
    count: (count: number) => (count === 1 ? "1 Clip" : `${count} Clips`),
    add: "Hinzufügen",
    /** Accessible name of one clip's add button. */
    addLabel: (title: string, subtitle: string) =>
      `${title} (${subtitle}) hinzufügen`,
    /** A clip already in the collection; one clip is at most one entry. */
    added: "In der Sammlung",
    /** A player-specific clip, as in the collection's checklist. */
    single: "spielerbezogen",
    loading: "Clips werden geladen ...",
    loadFailed: "Die Clips konnten nicht geladen werden.",
    retry: "Erneut versuchen",
    addFailed:
      "Der Clip konnte nicht hinzugefügt werden. Bitte versuche es erneut.",
    /** No clip is ready anywhere yet. */
    none: "Noch keine fertigen Clips. Schneide auf der Spielseite zuerst Clips.",
    /** The filters match no clip. */
    noMatch: "Kein Clip passt zu diesen Filtern.",
  },
  create: {
    /** Starts a new collection, from the editor's header and the watch page. */
    open: "Neue Sammlung",
    label: "Name der Sammlung",
    placeholder: "z. B. Standards Woche 3",
    submit: "Anlegen",
    /** Where the watch page's form puts the clip. */
    submitWithClip: "Anlegen und bearbeiten",
    invalidName: "Bitte gib einen Namen ein (1-120 Zeichen).",
    failed:
      "Die Sammlung konnte nicht angelegt werden. Bitte versuche es erneut.",
  },
  watch: {
    /** Opens the chooser on the watch page's tag detail, once the clip is ready. */
    open: "In Sammlung bearbeiten",
    heading: "In welche Sammlung?",
    hint: "Der Clip-Editor öffnet sich in einem neuen Tab, mit diesem Clip ausgewählt.",
    loading: "Sammlungen werden geladen ...",
    loadFailed: "Die Sammlungen konnten nicht geladen werden.",
    /** A collection's clip count in the list. */
    clipCount: (count: number) => (count === 1 ? "1 Clip" : `${count} Clips`),
    /** No collection exists yet. */
    none: "Noch keine Sammlung. Lege unten die erste an.",
    failed:
      "Der Clip konnte nicht in die Sammlung gelegt werden. Bitte versuche es erneut.",
    /** Shown when the browser blocked the new tab. */
    blocked: "Der Browser hat den neuen Tab blockiert.",
    openEditor: "Clip-Editor öffnen",
    cancel: "Abbrechen",
  },
} as const;
