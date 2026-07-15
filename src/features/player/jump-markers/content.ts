/**
 * User-facing copy for the instant jump-marker mode (P1-1), kept in one place
 * rather than scattered as string literals across the components (per the repo's
 * localization rule). The audience is German-speaking coaches, so copy is German
 * ("Marker" is the accepted domain term for a tagged moment).
 */
export const jumpMarkersContent = {
  panelTitle: "Marker",
  panelHint:
    "Springe zwischen den getaggten Momenten - ohne auf Clips zu warten.",
  empty: "Noch keine Marker. Tagge einen Moment, um hierher zu springen.",
  previous: "Vorheriger Marker",
  next: "Nächster Marker",
  /** Announced after a jump, e.g. "Tor bei 1:30". */
  jumpedTo: (label: string, clock: string): string => `${label} bei ${clock}`,
  /** Label for a marker's jump button, e.g. "Zu Tor bei 1:30 springen". */
  jumpTo: (label: string, clock: string): string =>
    `Zu ${label} bei ${clock} springen`,
  /** Count summary, e.g. "3 Marker". */
  count: (n: number): string => `${n} Marker`,
  hotkeyHint: "Tasten , und . springen zum vorherigen / nächsten Marker.",
} as const;
