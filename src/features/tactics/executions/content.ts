/**
 * German copy for plan vs reality: a tactics scene's executions
 * ("Ausführungen"), the tagged moments where the team played it.
 */
import type { ExecutionOutcome } from "./outcome";

const count = (n: number) => (n === 1 ? "1 Ausführung" : `${n} Ausführungen`);

export const executionsContent = {
  opponentPrefix: "gegen",
  outcomes: {
    success: "Erfolgreich",
    failure: "Nicht erfolgreich",
    open: "Offen",
  } satisfies Record<ExecutionOutcome, string>,
  /** The count and success rate beside a scene. */
  summary: {
    count,
    rate: (percent: number) => `${percent} % erfolgreich`,
    unrated: "noch nicht bewertet",
    breakdown: (success: number, failure: number, open: number) =>
      `${success} erfolgreich, ${failure} nicht erfolgreich, ${open} offen`,
    rateLabel: "Erfolgsquote",
    rateHint: "Offene Ausführungen zählen nicht mit.",
  },
  /** The executions card under the board. */
  scene: {
    heading: "Ausführungen",
    description:
      "Die getaggten Momente, in denen ihr die Szene gespielt habt, und wie sie ausgingen.",
    link: "Ausführungen verknüpfen",
    watch: "Ausführungen ansehen",
    empty: {
      title: "Noch keine Ausführungen",
      hint: "Verknüpfe getaggte Ecken oder andere Momente aus euren Spielen mit dieser Szene.",
    },
    outcomeLabel: (moment: string) => `Ergebnis: ${moment}`,
    unlink: (moment: string) => `Verknüpfung lösen: ${moment}`,
    noClip: "Kein Clip",
  },
  /** The page that links tags to a scene. */
  picker: {
    title: "Ausführungen verknüpfen",
    description:
      "Wähle die getaggten Momente, in denen ihr diese Szene gespielt habt.",
    back: "Zurück zur Szene",
    filterHeading: "Tags filtern",
    type: "Tag-Typ",
    anyType: "Alle Typen",
    game: "Spiel",
    anyGame: "Alle Spiele",
    apply: "Filtern",
    listHeading: "Getaggte Momente",
    count: (n: number) => (n === 1 ? "1 Moment" : `${n} Momente`),
    linked: "Verknüpft",
    chosen: (n: number) => (n === 1 ? "1 ausgewählt" : `${n} ausgewählt`),
    submit: "Auswahl verknüpfen",
    submitting: "Wird verknüpft ...",
    noneChosen: "Wähle mindestens einen Moment.",
    none: {
      title: "Keine passenden Tags",
      hint: "Ändere den Tag-Typ oder das Spiel.",
    },
    defaultHint:
      "Liegt ein Tor-Tag im selben Zeitfenster, startet die Ausführung als erfolgreich, sonst als offen.",
  },
  /** The page that plays a scene's executions. */
  playlist: {
    title: (scene: string) => `Ausführungen: ${scene}`,
    back: "Zurück zur Szene",
    missing: (n: number) =>
      n === 1
        ? "1 Ausführung hat noch keinen fertigen Clip."
        : `${n} Ausführungen haben noch keinen fertigen Clip.`,
    empty: {
      title: "Noch keine fertigen Clips",
      hint: "Sobald der Clip einer Ausführung geschnitten ist, läuft er hier.",
    },
  },
  /** Linking a tag to a scene from the watch page's tag detail. */
  watch: {
    open: "Mit Szene verknüpfen",
    heading: "Mit Taktikszene verknüpfen",
    hint: "Wähle die Szene, die dieser Moment ausführt.",
    loading: "Szenen werden geladen ...",
    loadFailed: "Die Szenen konnten nicht geladen werden.",
    none: "Noch keine Szenen auf der Taktiktafel.",
    linked: (outcome: string) => `Verknüpft - ${outcome}`,
    link: (scene: string) => `Mit ${scene} verknüpfen`,
    unlink: (scene: string) => `Verknüpfung mit ${scene} lösen`,
    failed: "Das hat nicht geklappt. Versuch es noch einmal.",
    done: "Fertig",
  },
  errors: {
    unauthorized: "Bitte melde dich erneut an.",
    invalidId: "Ungültige Szene oder ungültiger Tag.",
    sceneNotFound: "Diese Szene gibt es nicht mehr.",
    notLinked: "Dieser Moment ist nicht mehr mit der Szene verknüpft.",
    invalidOutcome: "Ungültiges Ergebnis.",
    tooMany: "Zu viele Momente auf einmal. Wähle weniger aus.",
    unexpected: "Etwas ist schiefgelaufen. Versuch es noch einmal.",
  },
} as const;
