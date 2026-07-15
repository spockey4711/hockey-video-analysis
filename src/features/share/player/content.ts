/**
 * German copy for the per-player clip share surface (P0-11). Kept in one place
 * per the repo's localization rule; the page is login-free and the link can be
 * forwarded, so the copy stays neutral and names neither the coach nor the
 * player (the recipient already knows whose link it is).
 */
export const playerShareContent = {
  page: {
    title: "Deine Clips",
    subtitle:
      "Deine markierten Clips und alle Team-Clips - als Wiedergabeliste.",
  },
  /** Prefix before the opponent name in a clip's subtitle ("gegen HTHC"). */
  opponentPrefix: "gegen",
} as const;
