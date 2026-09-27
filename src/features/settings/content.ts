/**
 * User-facing copy for the coach settings page, kept in one place rather than
 * scattered as string literals across components (per the repo's localization
 * rule). The app's audience is German-speaking coaches, so copy is German.
 */
export const settingsContent = {
  title: "Einstellungen",
  subtitle:
    "Verwalte dein Trainer-Konto, das Spielformat, die Tag-Fenster, den Team-Link, die Darstellung und deine Geräte.",
  account: {
    title: "Konto",
    nameLabel: "Name",
    emailLabel: "E-Mail",
  },
  password: {
    title: "Passwort ändern",
    description:
      "Nach der Änderung wirst du auf allen anderen Geräten abgemeldet, auch in der Mac-App.",
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
    description:
      "Gilt nur für dieses Gerät. „System“ folgt der Einstellung des Betriebssystems. Die Textgröße gilt im Präsentationsmodus; auf großen Bildschirmen wächst der Text dort ohnehin mit.",
  },
  devices: {
    title: "Geräte",
    description:
      "Überall, wo du angemeldet bist: deine Browser und die Mac-App. Melde ab, was du nicht mehr nutzt oder nicht kennst.",
    listLabel: "Angemeldete Geräte",
    thisDevice: "Dieses Gerät",
    kinds: { web: "Browser", device: "Mac-App" },
    unknownName: "Unbekanntes Gerät",
    activeNow: "Gerade aktiv",
    lastUsed: (when: string) => `Zuletzt verwendet ${when}`,
    withinTheHour: "in der letzten Stunde",
    onDate: (date: string) => `am ${date}`,
    signOut: "Abmelden",
    signingOut: "Wird abgemeldet ...",
    signOutNamed: (name: string) => `${name} abmelden`,
    others: {
      action: "Alle anderen abmelden",
      confirm:
        "Alle anderen Browser und die Mac-App werden abgemeldet. Dort musst du dich neu anmelden.",
      confirmYes: "Ja, alle anderen abmelden",
      cancel: "Abbrechen",
      running: "Wird abgemeldet ...",
      success: "Alle anderen Geräte wurden abgemeldet.",
    },
    signedOut: "Das Gerät wurde abgemeldet.",
    errors: {
      invalidId: "Dieses Gerät gibt es nicht mehr.",
      unexpected: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
    },
  },
  errors: {
    currentRequired: "Bitte gib dein aktuelles Passwort ein.",
    currentWrong: "Das aktuelle Passwort ist falsch.",
    confirmMismatch: "Die Passwörter stimmen nicht überein.",
    sameAsOld: "Das neue Passwort muss sich vom aktuellen unterscheiden.",
    notSignedIn: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
    tooManyAttempts:
      "Zu viele Versuche. Bitte warte einen Moment und versuche es erneut.",
    changedButSignedOut:
      "Dein Passwort wurde geändert, aber du wurdest abgemeldet. Bitte melde dich mit dem neuen Passwort an.",
    unexpected: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
  },
} as const;
