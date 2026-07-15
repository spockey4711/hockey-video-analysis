/**
 * German copy for the team clip share surface (P0-10). Kept in one place per the
 * repo's localization rule; the page is login-free, so the copy stays neutral
 * and never names the coach.
 */
export const teamShareContent = {
  page: {
    title: "Team-Clips",
    subtitle: "Alle für das Team freigegebenen Clips - als Wiedergabeliste.",
  },
  /** Prefix before the opponent name in a clip's subtitle ("gegen HTHC"). */
  opponentPrefix: "gegen",
  /**
   * Coach-only surface (P2-4) that hands the coach the single team share link so
   * they never hand-build the URL. Distinct from {@link page}, which is the copy
   * on the login-free share view itself.
   */
  coachLink: {
    title: "Team-Link",
    description:
      "Ein Link zu allen team-freigegebenen Clips - teile ihn mit dem Team.",
    /** Shown in place of the link when `TEAM_SHARE_TOKEN` is unset. */
    disabled:
      "Team-Link deaktiviert. Setze TEAM_SHARE_TOKEN, um die Team-Freigabe zu aktivieren.",
  },
} as const;
