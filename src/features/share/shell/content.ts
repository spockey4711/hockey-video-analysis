/**
 * User-facing copy for the login-free share surface, kept in one place rather
 * than scattered as string literals (per the repo's localization rule). These
 * pages are reached by an unguessable secret link, so the chrome stays neutral
 * and never names the coach or exposes app navigation. Copy is German.
 */
export const shareContent = {
  shell: {
    brand: "Hockey Video Analysis",
    /** Reassures the recipient the link is private, mirrors the noindex intent. */
    privateBadge: "Privater Link",
    footerNote:
      "Geteilt über einen geheimen Link. Nicht öffentlich gelistet - bitte nur mit dem Team teilen.",
  },
  loading: {
    title: "Clips werden geladen ...",
  },
  empty: {
    title: "Noch keine Clips",
    body: "Für diesen Link sind noch keine Clips freigegeben. Sobald der Trainer welche teilt, erscheinen sie hier.",
  },
  expired: {
    title: "Link nicht mehr gültig",
    body: "Dieser geheime Link ist abgelaufen oder wurde zurückgezogen. Bitte den Trainer um einen neuen Link.",
  },
} as const;
