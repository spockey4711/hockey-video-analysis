/**
 * User-facing copy for the coach landing page, kept in one place rather than
 * scattered as string literals across components (per the repo's localization
 * rule). The app's audience is German-speaking coaches, so copy is German.
 */
export const homeContent = {
  hero: {
    eyebrow: "Feldhockey · Video-Analyse",
    title: "Tagge das Spiel. Teile die Clips.",
    subtitle:
      "Markiere Momente in einer mehrteiligen Spielaufnahme, verknüpfe sie mit deinen Spielerinnen und Spielern und teile geschnittene Clips über Geheim-Links ohne Login.",
  },
  /**
   * The demo-timeline signature. `caption` labels the mock as an example so it
   * is never mistaken for a real game; `hint` says what the coloured markers on
   * it mean.
   */
  timeline: {
    caption: "Beispiel-Spiel",
    hint: "Jeder Marker ist ein getaggter Moment - farbcodiert nach Typ.",
    quarterLabel: (n: number) => `Q${n}`,
  },
  /**
   * The end-to-end pipeline as an ordered sequence (Aufnehmen -> Teilen). The
   * order carries meaning, so these are numbered; the `#ablauf` anchor lets the
   * player card jump here.
   */
  steps: {
    anchorId: "ablauf",
    heading: "So funktioniert's",
    items: [
      {
        n: "01",
        title: "Aufnehmen",
        description:
          "Lade die Spielaufnahme hoch - auch in mehreren Kapiteln pro Halbzeit.",
      },
      {
        n: "02",
        title: "Taggen",
        description:
          "Markiere Momente auf einer durchgehenden Spielzeit und verknüpfe sie mit Spielerinnen und Spielern.",
      },
      {
        n: "03",
        title: "Schneiden",
        description:
          "Bestätigte Tags schneidet der Pipeline-Worker automatisch zu einzelnen Clips.",
      },
      {
        n: "04",
        title: "Teilen",
        description:
          "Verschicke Team- und Einzelclips über Geheim-Links - login-frei und nur für die Empfänger.",
      },
    ],
  },
  /** The two ways in: a coach signs in, a player opens a shared link. */
  audience: {
    heading: "Los geht's",
    coach: {
      title: "Für Coaches",
      description:
        "Melde dich an, um Spiele hochzuladen, Momente zu taggen und Clips zu teilen.",
      cta: "Anmelden",
    },
    player: {
      title: "Für Spieler & Teams",
      description:
        "Du hast einen Team- oder Spieler-Link von deinem Coach? Öffne ihn einfach - kein Login nötig.",
      cta: "So funktioniert's",
    },
  },
  signedOut: {
    cta: "Anmelden",
  },
  signedIn: {
    greeting: (name: string) => `Willkommen zurück, ${name}.`,
    cta: "Zu den Spielen",
    quickHeading: "Schnellzugriff",
    quickActions: [
      { label: "Neues Spiel", href: "/games/new", icon: "plus" },
      { label: "Kader", href: "/players", icon: "users" },
      { label: "Sammlungen", href: "/collections", icon: "film" },
    ],
    recentHeading: "Zuletzt",
    recentEmpty: {
      title: "Noch keine Spiele",
      hint: "Lege dein erstes Spiel an.",
    },
    recentAll: "Alle Spiele",
  },
} as const;
