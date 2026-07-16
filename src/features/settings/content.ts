/**
 * User-facing copy for the coach settings page, kept in one place rather than
 * scattered as string literals across components (per the repo's localization
 * rule). The app's audience is German-speaking coaches, so copy is German.
 */
export const settingsContent = {
  title: "Einstellungen",
  subtitle: "Verwalte dein Trainer-Konto und die Darstellung.",
  account: {
    title: "Konto",
    nameLabel: "Name",
    emailLabel: "E-Mail",
  },
  password: {
    title: "Passwort ändern",
    description:
      "Nach der Änderung wirst du auf allen anderen Geräten abgemeldet.",
    currentLabel: "Aktuelles Passwort",
    newLabel: "Neues Passwort",
    newHint: "Mindestens 8 Zeichen.",
    confirmLabel: "Neues Passwort bestätigen",
    submit: "Passwort ändern",
    submitting: "Wird geändert ...",
    success: "Dein Passwort wurde geändert.",
  },
  appearance: {
    title: "Darstellung",
    themeLabel: "Design",
    themeHint: "Wechsle zwischen hellem und dunklem Design.",
  },
  session: {
    title: "Sitzung",
    signOutHint: "Auf diesem Gerät abmelden.",
  },
  errors: {
    currentRequired: "Bitte gib dein aktuelles Passwort ein.",
    currentWrong: "Das aktuelle Passwort ist falsch.",
    confirmMismatch: "Die Passwörter stimmen nicht überein.",
    sameAsOld: "Das neue Passwort muss sich vom aktuellen unterscheiden.",
    notSignedIn: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
    unexpected: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
  },
} as const;
