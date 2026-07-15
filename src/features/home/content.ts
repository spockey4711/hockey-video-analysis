/**
 * User-facing copy for the coach landing page, kept in one place rather than
 * scattered as string literals across components (per the repo's localization
 * rule). The app's audience is German-speaking coaches, so copy is German.
 */
export const homeContent = {
  hero: {
    eyebrow: "Feldhockey",
    title: "Tagge das Spiel. Teile die Clips.",
    subtitle:
      "Markiere Momente in einer mehrteiligen Spielaufnahme, verknüpfe sie mit deinen Spielerinnen und Spielern und teile geschnittene Clips über Geheim-Links ohne Login.",
  },
  features: [
    {
      title: "Taggen",
      description:
        "Tore, Ecken und Aktionen auf einer durchgehenden Spielzeit festhalten.",
    },
    {
      title: "Schneiden",
      description:
        "Bestätigte Tags werden vom Pipeline-Worker zu Clips geschnitten.",
    },
    {
      title: "Teilen",
      description:
        "Team- und Einzelclips über nicht erratbare Geheim-Links verschicken.",
    },
  ],
  signedOut: {
    cta: "Anmelden",
  },
  signedIn: {
    greeting: (name: string) => `Willkommen zurück, ${name}.`,
    cta: "Zu den Spielen",
    recentHeading: "Zuletzt",
    recentEmpty: {
      title: "Noch keine Spiele",
      hint: "Lege dein erstes Spiel an.",
    },
    recentAll: "Alle Spiele",
  },
} as const;
