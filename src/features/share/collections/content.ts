/**
 * German copy for the clip-collections feature (P2-13). Two audiences share this
 * module per the repo's localization rule: the coach-only curation surfaces
 * (list + detail) and the login-free share view. The share copy stays neutral
 * and never names the coach, since the secret link can be forwarded to anyone.
 */
export const collectionsContent = {
  /** Coach-only curation surfaces (behind the coach guard). */
  coach: {
    list: {
      title: "Sammlungen",
      description:
        "Kuratiere benannte Clip-Sammlungen und teile jede über einen eigenen geheimen Link.",
      /** Shown when no collection exists yet. */
      empty: "Noch keine Sammlungen. Lege die erste an.",
      /** Column caption for the clip count on a list row. */
      clipCount: (count: number) => (count === 1 ? "1 Clip" : `${count} Clips`),
    },
    create: {
      label: "Name der Sammlung",
      placeholder: "z. B. Standards Woche 3",
      submit: "Sammlung anlegen",
    },
    detail: {
      /** Back link to the list. */
      back: "Alle Sammlungen",
      /** Heading over the ready-clip checklist. */
      clipsHeading: "Clips auswählen",
      clipsDescription:
        "Wähle die fertigen Clips aus, die in dieser Sammlung geteilt werden.",
      /** Shown in place of the checklist when no clip is ready yet. */
      noClips:
        "Noch keine fertigen Clips vorhanden. Sobald Clips geschnitten sind, erscheinen sie hier.",
      nameLabel: "Name der Sammlung",
      save: "Sammlung speichern",
      saved: "Gespeichert",
      /** Prefix before the opponent in a clip's checklist label. */
      opponentPrefix: "gegen",
      /** Marks a player-specific clip in the checklist so the coach curates knowingly. */
      singleBadge: "spielerbezogen",
      shareLinkLabel: "Geheimer Link",
      copy: "Kopieren",
      copied: "Kopiert",
      rotate: {
        title: "Link zurücksetzen",
        description:
          "Setzt einen neuen geheimen Link und macht den bisherigen ungültig.",
        submit: "Link zurücksetzen",
      },
      delete: {
        title: "Sammlung löschen",
        description:
          "Löscht die Sammlung und ihren Link. Die einzelnen Clips bleiben erhalten.",
        submit: "Sammlung löschen",
      },
    },
    errors: {
      unauthorized: "Nicht angemeldet.",
      invalidName: "Bitte gib einen Namen ein (1-120 Zeichen).",
      invalidId: "Ungültige Sammlung.",
      notFound: "Sammlung nicht gefunden.",
      unexpected: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
    },
  },
  /** Login-free share view copy (see {@link ../shell}). */
  share: {
    /** Prefix before the opponent name in a clip's subtitle ("gegen HTHC"). */
    opponentPrefix: "gegen",
    /** Fallback subtitle when a collection has no name (should not happen). */
    fallbackSubtitle: "Kuratierte Clips - als Wiedergabeliste.",
  },
} as const;
