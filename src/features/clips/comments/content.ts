/**
 * German copy for the clip comment thread (P2-3), kept in one place rather
 * than as scattered literals (per the repo's localization rule). The thread
 * renders on the login-free share links as well as for the coach, so the copy
 * stays neutral: it never names the coach or another player (the coach-only
 * delete copy aside).
 */
export const commentsContent = {
  /** Accessible name of the whole thread region. */
  regionLabel: "Kommentare",
  /** Heading above the list; `count` is the number of loaded comments. */
  heading: (count: number) =>
    count === 0 ? "Kommentare" : `Kommentare (${count})`,
  loading: "Kommentare werden geladen ...",
  empty: {
    title: "Noch keine Kommentare",
    hint: "Schreib den ersten.",
  },
  /**
   * Badge on a comment the coach posted while signed in; it is pinned above
   * the thread and doubles as the clip's subtitle on a collection link.
   */
  coachLabel: "Trainer",
  form: {
    /** Accessible name of the new-comment form. */
    label: "Neuer Kommentar",
    authorLabel: "Name",
    authorPlaceholder: "Dein Name",
    bodyLabel: "Kommentar",
    bodyPlaceholder: "Was ist dir an diesem Clip aufgefallen?",
    submit: "Kommentieren",
    submitting: "Wird gesendet ...",
  },
  /**
   * The coach's delete control on each comment (moderation). Only a signed-in
   * coach sees it, so this copy may say what the share links will show.
   */
  delete: {
    /** Accessible name of the trash button; names the author to tell rows apart. */
    label: (author: string) => `Kommentar von ${author} löschen`,
    confirm: "Kommentar löschen? Er verschwindet auch auf den geteilten Links.",
    confirmYes: "Löschen",
    deleting: "Wird gelöscht ...",
    cancel: "Abbrechen",
    error: "Der Kommentar konnte nicht gelöscht werden.",
  },
  errors: {
    load: "Die Kommentare konnten nicht geladen werden.",
    submit: "Der Kommentar konnte nicht gesendet werden.",
    /** The server rejected the fields (e.g. after the client-side trim). */
    invalid: "Bitte Name und Kommentar ausfüllen.",
  },
} as const;
