/**
 * User-facing copy for the coach access flow, kept in one place rather than
 * scattered as string literals across components (per the repo's localization
 * rule). The app's audience is German-speaking coaches, so copy is German.
 */
export const accessContent = {
  login: {
    title: "Anmelden",
    subtitle: "Melde dich an, um Spiele zu taggen und Clips zu teilen.",
    emailLabel: "E-Mail",
    passwordLabel: "Passwort",
    submit: "Anmelden",
    submitting: "Wird angemeldet ...",
    signupPrompt: "Noch kein Konto?",
    signupLink: "Konto anlegen",
  },
  signup: {
    title: "Konto anlegen",
    subtitle: "Lege ein Trainer-Konto mit deinem Einladungscode an.",
    nameLabel: "Name",
    emailLabel: "E-Mail",
    passwordLabel: "Passwort",
    passwordHint: "Mindestens 8 Zeichen.",
    inviteLabel: "Einladungscode",
    submit: "Konto anlegen",
    submitting: "Wird angelegt ...",
    loginPrompt: "Schon ein Konto?",
    loginLink: "Anmelden",
    disabledTitle: "Registrierung deaktiviert",
    disabledBody:
      "Die Registrierung ist nicht aktiviert. Wende dich an die Administration, um ein Trainer-Konto zu erhalten.",
  },
  shell: {
    brand: "Hockey Video Analysis",
    signedInAs: "Angemeldet als",
    signOut: "Abmelden",
    signingOut: "Wird abgemeldet ...",
  },
  errors: {
    invalidCredentials: "E-Mail oder Passwort ist falsch.",
    tooManyAttempts:
      "Zu viele Versuche. Bitte warte einen Moment und versuche es erneut.",
    emailRequired: "Bitte gib eine E-Mail-Adresse ein.",
    emailInvalid: "Das ist keine gültige E-Mail-Adresse.",
    emailTaken: "Für diese E-Mail existiert bereits ein Konto.",
    nameRequired: "Bitte gib einen Namen ein.",
    passwordRequired: "Bitte gib ein Passwort ein.",
    passwordTooShort: "Das Passwort muss mindestens 8 Zeichen lang sein.",
    inviteRequired: "Bitte gib den Einladungscode ein.",
    inviteInvalid: "Der Einladungscode ist ungültig.",
    unexpected: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
  },
} as const;
