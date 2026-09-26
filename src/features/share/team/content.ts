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
    /** Label over the copyable link field. */
    fieldLabel: "Team-Link",
    /** Shown in place of the link while the team view is off. */
    disabled:
      "Noch kein Team-Link. Erzeuge ihn unter Einstellungen > Teilen, um die Team-Freigabe zu aktivieren.",
    /** On the roster, where the link is only copied: where to replace it. */
    manageHint: "Neuen Link erzeugen: Einstellungen > Teilen",
    manageLinkLabel: "Einstellungen > Teilen",
    loading: "Team-Link wird geladen ...",
  },
  /** The team link's controls under Einstellungen > Teilen. */
  settings: {
    title: "Teilen",
    description:
      "Der Team-Link zeigt allen, die ihn haben, jeden team-freigegebenen Clip - ohne Anmeldung.",
    disabled:
      "Die Team-Freigabe ist aus. Erzeuge einen Link, um sie zu aktivieren.",
    /** Create the first link: nothing is revoked, so no confirm step. */
    create: {
      submit: "Team-Link erzeugen",
      running: "Wird erzeugt ...",
      success: "Team-Link erstellt. Teile ihn mit dem Team.",
    },
    /** Replace the link: the old one stops working, so it is confirm-gated. */
    regenerate: {
      submit: "Neuen Link erzeugen",
      hint: "Der bisherige Link funktioniert danach sofort nicht mehr - auch in schon geöffneten Fenstern.",
      confirm:
        "Wer den bisherigen Team-Link hat, sieht die Clips danach nicht mehr. Wirklich einen neuen Link erzeugen?",
      confirmYes: "Ja, neuen Link erzeugen",
      cancel: "Abbrechen",
      running: "Wird erzeugt ...",
      success:
        "Neuer Team-Link erstellt. Der alte Link funktioniert nicht mehr.",
    },
    errors: {
      unauthorized: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
      unexpected: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
    },
  },
} as const;
