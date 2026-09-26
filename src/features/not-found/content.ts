/**
 * Copy for the app-wide "page not found" state (`app/not-found.tsx`), shown for
 * an unknown route and for a share link whose token does not resolve. It stays
 * generic on purpose: it never says whether a link once existed. German.
 */
export const notFoundContent = {
  title: "Seite nicht gefunden",
  hint: "Die Adresse stimmt nicht oder der Link gilt nicht mehr.",
  home: "Zur Startseite",
} as const;
