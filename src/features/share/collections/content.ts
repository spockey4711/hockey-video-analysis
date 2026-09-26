/**
 * German copy for the clip-collections feature (P2-13). Two audiences share this
 * module per the repo's localization rule: the coach-only curation surfaces
 * (list + detail) and the login-free share view. The share copy stays neutral
 * and never names the coach, since the secret link can be forwarded to anyone.
 */
/** Seconds with a German decimal comma and a non-breaking space: "4,5 s". */
function formatSeconds(seconds: number): string {
  return `${String(Math.round(seconds * 10) / 10).replace(".", ",")}\u00a0s`;
}

export const collectionsContent = {
  /** Coach-only curation surfaces (behind the coach guard). */
  coach: {
    list: {
      title: "Sammlungen",
      description:
        "Kuratiere benannte Clip-Sammlungen und teile jede über einen eigenen geheimen Link.",
      /** Shown when no collection exists yet. */
      empty: {
        title: "Noch keine Sammlungen",
        hint: "Lege die erste an.",
      },
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
      /** Opens the clip editor for the whole collection, in a new tab. */
      openEditor: "Im Editor bearbeiten",
      /** Opens the clip editor on one member clip, in a new tab. */
      editClip: "Bearbeiten",
      editClipLabel: (title: string) => `${title} im Editor bearbeiten`,
      /** Heading over the ready-clip checklist. */
      clipsHeading: "Clips auswählen",
      clipsDescription:
        "Wähle die fertigen Clips aus, die in dieser Sammlung geteilt werden.",
      /** Shown in place of the checklist when no clip is ready yet. */
      noClips: {
        title: "Noch keine fertigen Clips",
        hint: "Sobald Clips geschnitten sind, erscheinen sie hier.",
      },
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
      /**
       * The notes for the team, public to anyone with the link. Worded so the
       * coach never mistakes them for the private presenter notes below.
       */
      teamNotes: {
        heading: "Für das Team sichtbar",
        description:
          'Jeder mit dem Link sieht diese Texte: in der Wiedergabeliste unter dem Clip und im Präsentationsmodus als Titelkarte vor dem Clip. Was nur du sehen sollst, schreibst du unten in die "Präsentationsnotizen".',
        collectionLabel: "Einleitung zur Sammlung",
        collectionHint:
          "Steht auf dem Link über den Clips und im Präsentationsmodus vor dem ersten Clip.",
        /** Shown in place of the clip texts when the collection holds no clip yet. */
        noClips: {
          title: "Noch keine Clips ausgewählt",
          hint: "Wähle oben Clips aus und speichere die Sammlung, dann kannst du zu jedem Clip einen Text schreiben.",
        },
        save: "Texte speichern",
      },
      /** The coach's private presenter notes for presentation mode. */
      notes: {
        heading: "Präsentationsnotizen",
        description:
          "Nur für dich: Wenn du angemeldet bist, blendest du sie im Präsentationsmodus des Links mit H ein. Wer den Link ohne Anmeldung öffnet, sieht sie nie.",
        collectionLabel: "Notiz zur Sammlung",
        collectionHint: "Erscheint beim ersten Clip.",
        /** Shown in place of the clip notes when the collection holds no clip yet. */
        noClips: {
          title: "Noch keine Clips ausgewählt",
          hint: "Wähle oben Clips aus und speichere die Sammlung, dann kannst du zu jedem Clip eine Notiz schreiben.",
        },
        save: "Notizen speichern",
      },
      /** Tactics scenes placed between the clips (ADR 0014). */
      scenes: {
        heading: "Taktikszenen",
        description:
          "Szenen von der Taktiktafel laufen im Link und im Präsentationsmodus als eigener Eintrag zwischen den Clips. Schiebe sie im Ablauf an ihre Stelle.",
        pickLabel: "Szene",
        add: "Szene hinzufügen",
        /** No scene exists on the tactics board yet. */
        noScenes: {
          title: "Noch keine Szenen",
          hint: "Lege auf der Taktiktafel eine Szene an, dann kannst du sie hier einfügen.",
        },
        openBoard: "Zur Taktiktafel",
        allAdded: "Alle Szenen sind schon in dieser Sammlung.",
        orderHeading: "Ablauf",
        /** Nothing to arrange yet: no ready clip and no scene. */
        emptyOrder: {
          title: "Noch nichts im Ablauf",
          hint: "Wähle oben Clips aus oder füge eine Szene hinzu.",
        },
        still: "Standbild",
        animated: (seconds: number) => `Animation, ${formatSeconds(seconds)}`,
        holdLabel: "Standzeit",
        holdOption: (seconds: number) => formatSeconds(seconds),
        moveUp: (name: string) => `${name} nach oben`,
        moveDown: (name: string) => `${name} nach unten`,
        remove: (name: string) => `${name} aus der Sammlung nehmen`,
      },
      delete: {
        title: "Sammlung löschen",
        description:
          "Löscht die Sammlung und ihren Link. Die einzelnen Clips bleiben erhalten.",
        submit: "Sammlung löschen",
      },
    },
    /** Insights on the detail page: views and comments per clip. */
    insights: {
      heading: "Auswertung",
      description:
        "Wie oft die Clips über den geheimen Link angesehen wurden und was dazu kommentiert wurde.",
      /** Accessible name of the collection-wide figures. */
      summaryLabel: "Gesamte Sammlung",
      clicks: "Klicks",
      fullViews: "Ganz angesehen",
      replays: "Wiederholt",
      uniqueViewers: "Zuschauer (pro Tag)",
      /** Why a viewer who returns on another day counts again. */
      uniqueViewersHint:
        "Zuschauer werden pro Tag gezählt: Wer an drei Tagen schaut, zählt dreimal.",
      /** Accessible name of one clip's figures. */
      clipFiguresLabel: (title: string) => `Zahlen zu ${title}`,
      commentsHeading: (count: number) =>
        count === 1 ? "1 Kommentar" : `${count} Kommentare`,
      noComments: "Noch keine Kommentare.",
      /** The collection holds no clip yet. */
      noClips: {
        title: "Noch keine Clips ausgewählt",
        hint: "Wähle unten Clips aus, dann erscheint hier ihre Auswertung.",
      },
      /** Nothing has been viewed or commented yet. */
      emptyTitle: "Noch keine Aufrufe",
      emptyHint:
        "Sobald jemand den Link öffnet oder einen Clip kommentiert, stehen die Zahlen hier.",
    },
    errors: {
      unauthorized: "Nicht angemeldet.",
      invalidName: "Bitte gib einen Namen ein (1-120 Zeichen).",
      invalidId: "Ungültige Sammlung.",
      invalidNote: "Eine Notiz ist zu lang (höchstens 1000 Zeichen).",
      invalidTeamNote:
        "Ein Text für das Team ist zu lang (höchstens 500 Zeichen).",
      notFound: "Sammlung nicht gefunden.",
      sceneNotFound: "Diese Szene gibt es nicht mehr.",
      sceneDuplicate: "Diese Szene ist schon in der Sammlung.",
      invalidScene: "Ungültige Szene.",
      unexpected: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
    },
  },
  /** Login-free share view copy (see {@link ../shell}). */
  share: {
    /** Prefix before the opponent name in a clip's subtitle ("gegen HTHC"). */
    opponentPrefix: "gegen",
    /** Static qualifier under the collection name on the share view. */
    subtitle: "Kuratierte Clips - als Wiedergabeliste.",
    /** Accessible name of the coach's intro above the clips. */
    introLabel: "Einleitung",
    /** The subtitle of a tactics scene entry, by whether it moves. */
    scene: {
      still: "Taktikszene - Standbild",
      animated: (seconds: number) =>
        `Taktikszene - Animation, ${formatSeconds(seconds)}`,
    },
  },
} as const;
