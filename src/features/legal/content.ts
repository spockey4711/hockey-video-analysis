/**
 * User-facing copy for the Impressum and the Datenschutzerklärung, kept in one
 * place rather than scattered as string literals (per the repo's localization
 * rule). Copy is German. The operator's own details are never written here -
 * they come from the environment (see `operator.ts`).
 *
 * The privacy text describes what the app processes today, derived from the
 * code: coach accounts and the session cookie, the login rate limiter, the
 * theme and telestration-stroke-width preferences in local storage, the
 * roster, tags, clips, share tokens and comments, the anonymous view counts
 * on collection links, the self-hosted server and the originals on Google
 * Drive. It is a draft the operator must check; keep it in step whenever the
 * app starts processing something new.
 *
 * Review rule: every new `hva-*` browser storage key (localStorage,
 * sessionStorage or a cookie) must be added to the "Cookies und lokaler
 * Speicher" section above. `tests/unit/legal/storage-keys.test.ts` enforces
 * this by collecting every such key defined under `src/` and failing if this
 * file does not mention it.
 */

/** One section of the privacy policy: a heading, prose and an optional list. */
export interface LegalSection {
  readonly id: string;
  readonly heading: string;
  readonly paragraphs: readonly string[];
  readonly items?: readonly string[];
}

/** Opening sentence of the hosting section; the hoster is named when configured. */
function hostingIntro(provider: string | null): string {
  const where = provider
    ? `auf einem selbst verwalteten Server bei ${provider}`
    : "auf einem selbst verwalteten Server, der bei einem Hosting-Anbieter angemietet ist";
  return `Die Anwendung läuft ${where}. Der Anbieter verarbeitet die Daten in unserem Auftrag nach Art. 28 DSGVO.`;
}

/**
 * The policy's sections after the controller block. `hostingProvider` is the
 * optional `LEGAL_HOSTING_PROVIDER`; unset keeps the hosting text generic.
 */
function privacySections(
  hostingProvider: string | null,
): readonly LegalSection[] {
  return [
    {
      id: "ueberblick",
      heading: "Worum es geht",
      paragraphs: [
        "Hockey Video Analysis ist ein nicht-kommerzielles Werkzeug für die Video-Analyse einer Feldhockey-Mannschaft. Trainerinnen und Trainer markieren Szenen in Spielaufnahmen, schneiden daraus Clips und teilen sie über geheime Links mit dem Team und einzelnen Spielerinnen und Spielern.",
        "Es gibt kein Tracking über Websites hinweg, keine Analyse- oder Werbedienste von Dritten und keine Cookies zu Marketingzwecken. Auf den Links für Clip-Sammlungen wird lediglich anonym gezählt, wie Clips angesehen werden (siehe unten).",
      ],
    },
    {
      id: "hosting",
      heading: "Hosting und Server-Logdateien",
      paragraphs: [
        hostingIntro(hostingProvider),
        "Beim Aufruf jeder Seite überträgt Ihr Browser technisch bedingt Daten an den Server: IP-Adresse, Datum und Uhrzeit, die aufgerufene Adresse (bei geteilten Links einschließlich des geheimen Link-Schlüssels), die übertragene Datenmenge, den Browsertyp und das Betriebssystem. Der Server und ein vorgeschalteter Webserver können diese Angaben in Logdateien speichern, um den Betrieb sicherzustellen und Angriffe zu erkennen.",
        "Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; das berechtigte Interesse liegt im sicheren und stabilen Betrieb. Die Logdateien werden nur so lange aufbewahrt, wie es für diesen Zweck erforderlich ist, und danach gelöscht.",
      ],
    },
    {
      id: "trainer-konten",
      heading: "Trainer-Konten und Anmeldung",
      paragraphs: [
        "Für ein Trainer-Konto werden Name, E-Mail-Adresse und das Passwort gespeichert. Das Passwort wird nur als nicht umkehrbarer Hash (scrypt) abgelegt. Konten können nur mit einem Einladungscode angelegt werden.",
        "Nach der Anmeldung wird eine Sitzung in der Datenbank gespeichert und ein Sitzungs-Cookie gesetzt (siehe unten). Um das Erraten von Passwörtern zu erschweren, merkt sich der Server fehlgeschlagene Anmeldeversuche je IP-Adresse und E-Mail-Adresse für höchstens 15 Minuten im Arbeitsspeicher.",
        "Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung des Kontos) und für die Missbrauchsabwehr Art. 6 Abs. 1 lit. f DSGVO. Die Kontodaten bleiben gespeichert, bis das Konto gelöscht wird.",
      ],
    },
    {
      id: "cookies",
      heading: "Cookies und lokaler Speicher",
      paragraphs: [
        "Die Anwendung setzt nur technisch notwendige Speicher ein, keine Cookies von Dritten und keine Cookies zu Analyse- oder Werbezwecken:",
      ],
      items: [
        "Sitzungs-Cookie „hva_session“: hält angemeldete Trainerinnen und Trainer 30 Tage lang angemeldet oder bis zur Abmeldung. Das Cookie ist für Skripte nicht lesbar (HttpOnly) und wird nur für angemeldete Konten gesetzt; Besucherinnen und Besucher geteilter Links erhalten kein Cookie.",
        "Lokaler Speicher „hva-theme“: merkt sich im Browser, ob das helle oder das dunkle Design gewählt wurde. Der Wert verlässt den Browser nicht.",
        "Lokaler Speicher „hva-telestration-width“: merkt sich im Browser die zuletzt gewählte Strichstärke für Einzeichnungen auf Standbildern. Der Wert verlässt den Browser nicht.",
      ],
    },
    {
      id: "spielerdaten",
      heading: "Spielaufnahmen, Kader und Clips",
      paragraphs: [
        "Verarbeitet werden Videoaufnahmen von Spielen, auf denen Spielerinnen und Spieler zu sehen sind, die Namen und Rückennummern im Kader, markierte Szenen mit den beteiligten Spielerinnen und Spielern sowie die daraus geschnittenen Clips.",
        "Zweck ist die Trainings- und Spielanalyse der Mannschaft. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; das berechtigte Interesse liegt in der sportlichen Förderung der Mannschaft. Soweit dafür eine Einwilligung eingeholt wurde, ist Rechtsgrundlage Art. 6 Abs. 1 lit. a DSGVO; eine Einwilligung kann jederzeit mit Wirkung für die Zukunft widerrufen werden. Die Daten werden gelöscht, sobald sie für die Analyse nicht mehr benötigt werden oder eine Person der Verarbeitung widerspricht und keine vorrangigen Gründe entgegenstehen.",
      ],
    },
    {
      id: "geheime-links",
      heading: "Geheime Links",
      paragraphs: [
        "Clips werden über schwer zu erratende geheime Links geteilt: einen Link für das Team, je einen Link pro Spielerin oder Spieler und Links für Clip-Sammlungen. Wer einen Link kennt, kann die dafür freigegebenen Clips ohne Anmeldung ansehen. Clips, die nur für eine Person bestimmt sind, erscheinen ausschließlich auf deren eigenem Link.",
        "Die Link-Seiten sind für Suchmaschinen gesperrt. Ein Link kann jederzeit durch einen neuen ersetzt werden; der alte Link ist dann ungültig. Bitte geben Sie Links nicht an Personen außerhalb der Mannschaft weiter.",
      ],
    },
    {
      id: "aufrufzaehlung",
      heading: "Anonyme Aufrufzählung bei Clip-Sammlungen",
      paragraphs: [
        "Auf dem Link einer Clip-Sammlung zählt der Server, wie oft ein Clip gestartet, vollständig angesehen (mindestens 90 % seiner Länge) und erneut abgespielt wird, damit die Trainerinnen und Trainer sehen, welche Clips ankommen. Die Links für das Team und für einzelne Spielerinnen und Spieler zählen nichts, und Aufrufe angemeldeter Trainerinnen und Trainer werden nicht mitgezählt.",
        "Dafür werden keine Cookies gesetzt und nichts im Browser gespeichert. Um verschiedene Besucherinnen und Besucher auseinanderzuhalten, bildet der Server aus IP-Adresse, Browserkennung (User-Agent) und Sammlung einen Hashwert mit einem zufälligen Schlüssel, der nur im Arbeitsspeicher liegt und jeden Tag um Mitternacht (UTC) verworfen und neu erzeugt wird. Gespeichert werden nur dieser Hashwert, der Clip, die Art des Ereignisses und der Zeitpunkt, weder die IP-Adresse noch die Browserkennung. Da der Schlüssel eines Tages danach nicht mehr existiert, lässt sich ein Hashwert keiner Person und keinem Gerät mehr zuordnen; dieselbe Person erhält an jedem Tag und in jeder Sammlung einen anderen Wert.",
        "Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; das berechtigte Interesse liegt darin, die geteilten Clips an ihrer tatsächlichen Nutzung auszurichten. Die Zählereignisse werden nach 12 Monaten gelöscht, zusammen mit der Sammlung oder dem Clip auch früher.",
      ],
    },
    {
      id: "kommentare",
      heading: "Kommentare",
      paragraphs: [
        "Zu einem Clip können Kommentare geschrieben werden. Gespeichert werden der angegebene Name, der Kommentartext und der Zeitpunkt. Kommentare sind für alle sichtbar, die über einen Link oder als Trainerin oder Trainer Zugriff auf den Clip haben. Bitte geben Sie nur einen Namen an, unter dem Sie im Team bekannt sind, und keine sensiblen Angaben.",
        "Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; das berechtigte Interesse liegt im Austausch über die Clips. Kommentare werden gelöscht, wenn der zugehörige Clip gelöscht wird, oder auf Anfrage.",
      ],
    },
    {
      id: "google-drive",
      heading: "Speicherung der Originalaufnahmen bei Google Drive",
      paragraphs: [
        "Die ungeschnittenen Originalaufnahmen der Spiele liegen im Cloud-Speicher Google Drive der Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland. Der Server liest sie von dort, um verkleinerte Arbeitskopien und Clips zu erstellen; diese abgeleiteten Dateien liegen auf dem eigenen Server.",
        "Eine Übermittlung an die Google LLC in den USA ist nicht ausgeschlossen. Die Google LLC ist nach dem EU-US Data Privacy Framework zertifiziert, für das ein Angemessenheitsbeschluss der EU-Kommission besteht (Art. 45 DSGVO).",
      ],
    },
    {
      id: "rechte",
      heading: "Ihre Rechte",
      paragraphs: [
        "Sie haben nach der DSGVO folgende Rechte gegenüber dem oben genannten Verantwortlichen. Für eine Anfrage genügt eine formlose Nachricht an die oben genannte E-Mail-Adresse.",
      ],
      items: [
        "Auskunft über die zu Ihnen gespeicherten Daten (Art. 15 DSGVO)",
        "Berichtigung unrichtiger Daten (Art. 16 DSGVO)",
        "Löschung (Art. 17 DSGVO) und Einschränkung der Verarbeitung (Art. 18 DSGVO)",
        "Datenübertragbarkeit (Art. 20 DSGVO)",
        "Widerspruch gegen eine Verarbeitung auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO (Art. 21 DSGVO)",
        "Widerruf einer erteilten Einwilligung mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO)",
        "Beschwerde bei einer Datenschutz-Aufsichtsbehörde (Art. 77 DSGVO)",
      ],
    },
  ];
}

export const legalContent = {
  links: {
    navLabel: "Rechtliches",
    impressum: "Impressum",
    privacy: "Datenschutz",
  },
  missing: {
    title: "Angaben unvollständig",
    /** Production: tell the visitor, without naming internals. */
    body: "Die Angaben zum Betreiber werden gerade ergänzt.",
    /** Development: name the unset variables so the operator can fix them. */
    devBody: "Diese Umgebungsvariablen sind nicht gesetzt:",
  },
  impressum: {
    title: "Impressum",
    operatorHeading: "Angaben gemäß § 5 DDG",
    contactHeading: "Kontakt",
    emailLabel: "E-Mail",
    phoneLabel: "Telefon",
    responsibleHeading: "Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV",
    noteHeading: "Hinweis",
    note: "Hockey Video Analysis ist ein nicht-kommerzielles Werkzeug für die Video-Analyse einer Feldhockey-Mannschaft. Die Inhalte sind nicht öffentlich und nur über persönliche Zugänge oder geheime Links erreichbar.",
  },
  privacy: {
    title: "Datenschutzerklärung",
    updated: "Stand: September 2026",
    controllerHeading: "Verantwortlicher",
    controllerIntro:
      "Verantwortlich für die Datenverarbeitung in dieser Anwendung ist:",
    sections: privacySections,
  },
} as const;
