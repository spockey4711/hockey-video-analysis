# Verkaufbarkeit und MVP-Lücken — Vorschlag

**Status: Vorschlag, nicht entschieden und nicht umgesetzt.** Dieses Dokument ändert weder
ADR-Status noch Produktumfang. Kein Paket unten ist freigegeben. Es enthält keine Marktstatistik,
keine Kundenzahl und keine belegte Zahlungsbereitschaft. Wo etwas nur eine Annahme ist, steht
**Hypothese**.

Grundlage: der Baum auf Branch `agent/completion-batch-1` und
[`docs/project/backlog.md`](project/backlog.md), [`docs/project/mac-app-plan.md`](project/mac-app-plan.md),
[`docs/project/coach-guide.md`](project/coach-guide.md), die ADRs 0008 und 0013 sowie der
Abschlussplan. Die GitHub-API wurde für diesen Vorschlag nicht erneut abgefragt. Im Repo sind
keine Produkt-Issues verlinkt. Der gelesene Abschlussplan nannte im GitHub-Ausschnitt keine
offenen Produkt-Issues, nur Dependabot-PRs. Die Pakete unten wiederholen deshalb den bestehenden
Plan, statt neue Issues zu erfinden.

## Einordnung: Portfolio oder verkaufbares Produkt

**Belegt:** Die App ist ein Einzelteam-Werkzeug. `team_settings` ist eine einzelne Zeile
(`src/lib/db/schema.ts`). Coach-Seiten, Freigabelinks und Worker lesen eine Postgres-Datenbank.
Spieler sehen Clips nur über geheime Links ohne Login (`README.md`, `docs/project/coach-guide.md`).
Originale liegen nach ADR 0008 auf Google Drive, nicht in einem Multi-Tenant-Shop.

**Hypothese:** Das belegte Produkt ist zuerst das eigene Trainerwerkzeug und ein technisches
Portfolio, nicht ein eigenständiges SaaS. Ein Verkauf an andere Vereine wäre ein späterer Schritt
und ist hier nicht entschieden. Ein Domain-Konflikt zwischen zwei Portfolios wird hier nicht
entschieden. Ein SaaS-Zwang folgt aus dem jetzigen Baum nicht: der Betrieb ist ein selbst
gehostetes Team.

## 1. Belegte Anforderung, vorhandener Flow, echte Lücke

| Anforderung | Beleg | Vorhandener Flow | Echte MVP-Lücke |
| --- | --- | --- | --- |
| Momente taggen und Clips an Team oder Spieler geben | `README.md`, `docs/project/coach-guide.md` | Watch-Seite, `POST /api/tags`, `POST /api/clips`, Team-Link auf `/players` | Der Browser-Pfad Login, Spiel, Tag, Einreihen ist erst mit `tests/e2e/coach-flow.spec.ts` abgedeckt. Ein Schnitt bis `ready` braucht den Clip-Worker und eine echte Datei; der Browser-Test reiht nur ein. |
| Spiel ohne Handanlage der Kapitel anlegen | Backlog P2-9, P2-17, P2-18; ADR 0008 | Drive-Worker unter `src/features/ingest/**`, Review „Neu eingegangen“ | P2-17 lässt Deploy, Umschaltung und einen echten Spieldurchlauf offen. `docker-compose.yml` enthält keinen Ingest-Dienst. Ob der Host das schon tut, steht nicht im Repo. |
| Mac als Schnittplatz: Karte, offline taggen, lokal schneiden, Link spielt | ADR 0013 (Status bleibt Proposed), `docs/project/mac-app-plan.md` M5/M6 | M1–M4 und Server S2–S5 sind im Baum (`mac/README.md`, App-API unter `src/app/api/app/v1/`) | M5 und M6 fehlen. Der Server schneidet `mac`-Spiele nicht (`src/features/clips/cut/queue.ts`). Ein Mac-Build ist hier nicht gelaufen und braucht macOS. |
| Mac-Spiele auch im Browser taggen, ohne Originale auf den VPS zu laden | ADR 0013 D5, Plan S6/M7 | Upload-Zweck ist nur `clip` (`src/lib/db/schema.ts`) | Keine 720p-Kopie, kein Wartezustand statt stillem Fallback auf fehlende Originale. |
| Originale von Mac-Spielen nach Drive sichern, ohne Zweitimport | ADR 0013 D4, Plan S7/M8 | Registrierung legt die Ordnerzeile an (`src/features/app-api/games.ts`) | Der Mac kopiert nicht. |
| Pfeif-Vorschläge und Auto-Kamera | Backlog-Scope-Note, `docs/project/roadmap-auto-camera.md` | Suggestion-API und ungemountete UI; Auto-Kamera ist Forschung | Bewusst nicht im MVP. Kein Paket hier zieht sie hinein. |

## 2. Nächste Pakete

Alle fünf sind **awaiting_approval**. Keines wird in diesem Lauf umgesetzt. Aufwand ist eine
Schätzung aus dem bestehenden Plan, keine Offerte.

### 1. Drive-Import auf dem Zielhost zu Ende bringen

- **Entspricht:** Backlog P2-17, Rest von Teil 2. Kein neues Issue.
- **Aufwand:** M
- **Abhängigkeiten:** VPS, rclone-Mount, ffmpeg im Worker-Image. Kein App-Feature.
- **Akzeptanz:** Ein nach dem Start angelegter Ordner mit `halbzeit*` oder `GX*` wird nach der Quiet-Period ein Spiel mit `awaiting_proxies`, erscheint erst nach gültigen Proxies in der Review, und ein Coach kann es übernehmen. Ein unlesbarer Part erzeugt keine Spielzeile. Ein schon vorhandener Altordner wird nicht importiert.
- **Status:** awaiting_approval

### 2. Mac: Kartenimport (Plan M5)

- **Entspricht:** `docs/project/mac-app-plan.md` M5, Backlog MAC-M5. Kein neues Issue.
- **Aufwand:** L
- **Abhängigkeiten:** M1–M4 und `POST /api/app/v1/games` sind im Baum. Abschluss und Abnahme brauchen macOS. Dieser Lauf kann das nicht bauen oder vortäuschen.
- **Akzeptanz:** Auswahl und Kopie sind an synthetischen Kapiteln getestet. Manuell: echte Karte importieren, Kopie vergleichen, Karte auswerfen, offline taggen, nach Sync erscheint das Spiel im Web unter Review.
- **Status:** awaiting_approval

### 3. Mac: Clips schneiden und hochladen (Plan M6)

- **Entspricht:** Plan M6, Backlog MAC-M6. Server S5 existiert.
- **Aufwand:** L
- **Abhängigkeiten:** S5-API. Für den Kartenweg auch Paket 2. `UPLOAD_STAGING_ROOT` auf dem Host, sonst `503`. macOS für den Client.
- **Akzeptanz:** Unit-Tests gegen die Cut-Plan-Vektoren, inklusive Kapitelgrenze, an synthetischen Kapiteln. Manuell: der Link spielt den Clip. Ein `drive`-Spiel wird weiter nur vom Server-Worker geschnitten.
- **Status:** awaiting_approval

### 4. Browser-Kopie für Mac-Spiele (Plan S6/M7)

- **Entspricht:** Plan S6/M7, Backlog MAC-S6. Kein Duplikat anlegen.
- **Aufwand:** L
- **Abhängigkeiten:** Paket 3 (Upload-Protokoll).
- **Akzeptanz:** Ein Mac-Spiel ohne Kopie ist nicht abspielbar und sagt das. Nach Upload ist es im Browser taggbar. Ein Drive-Spiel ändert sein Proxy-Verhalten nicht.
- **Status:** awaiting_approval

### 5. Originale vom Mac nach Drive sichern (Plan S7/M8)

- **Entspricht:** Plan S7/M8, Backlog MAC-S7. Kein Duplikat anlegen.
- **Aufwand:** L
- **Abhängigkeiten:** Paket 1, damit der Worker den Ordner als bekannt erkennt. Der echte Kartenweg braucht Paket 2 und 3 nicht für die Server-Zeile, aber für den Coach-Ablauf.
- **Akzeptanz:** Nach dem Backup zeigt der Worker den Ordner als bekannt, nicht als neuen Import. Ein unvollständiger Upload löscht die lokale Bibliothek nicht.
- **Status:** awaiting_approval

Nicht in diesen fünf, weil der Backlog sie bewusst später hält: Whistle-Mount (P2-2), Auto-Kamera AC-1, Mac-Parität M9–M19, gebackener MP4-Export.

Weitere belegte Abläufe aus [`docs/project/coach-guide.md`](project/coach-guide.md) sind im Baum und hier kein offenes Paket: Viertel markieren, Clip-Links teilen und rotieren, Spielbericht, Teamvergleich, Taktiktafel. Ein Spiel über „Neues Spiel“ braucht einen Titel und landet in der normalen Liste. Nur ein Import ohne Titel wartet unter „Neu eingegangen“ (`isUnnamedGame` in `src/features/games/format.ts`).

## 3. Zielgruppe, Problem, Nutzen, Monetarisierung

Alles in diesem Abschnitt ist **Hypothese**, außer den belegten Sätzen.

- **Belegt:** Die Oberfläche und der Coach-Guide sprechen eine deutschsprachige Trainerperson an, die GoPro-Kapitel taggt und Links an Spieler oder das Team gibt.
- **Hypothese Zielgruppe:** Feldhockey-Trainerinnen und Trainer in einem Verein, die heute Clips von Hand suchen oder große Dateien verschicken. Ob das über diesen einen Einsatz hinausgeht, ist nicht belegt.
- **Hypothese Kernproblem:** Zwischen Aufnahme und einem teilbaren Clip vergeht zu viel Handarbeit, besonders wenn die Originale erst hochgeladen werden müssen, bevor getaggt werden kann (ADR 0013, Context).
- **Hypothese Nutzen:** Ein taggbarer Spielzeitstrahl und ein Link, den Spieler ohne Konto öffnen. Der Mac-Tagesnutzen (Karte rein, Clip auf dem Link) ist im Plan der erste tägliche Nutzen und im Baum noch offen.
- **Hypothese Monetarisierung, ohne Betrag und ohne belegte Zahlungsbereitschaft:** Wenn andere Vereine denselben Ablauf wollen, wäre ein denkbarer Weg eine Lizenz für eine selbst gehostete Vereinsinstanz oder ein betreuter Einzelverein-Betrieb. Ein Abo-SaaS mit vielen Mandanten ist eine weitere Hypothese, kein Befund. Es gibt im Repo keinen Shop, kein Preismodell und keinen Kunden außer dem beschriebenen Coach-Ablauf.

## 4. Kleinster Validierungstest ohne Zahlung

Nicht bauen, nicht abrechnen. Mit einer echten Trainerperson und einem echten Spiel, das schon
im Web anlegbar ist (Handanlage oder, falls der Host es schon tut, ein Drive-Ordner):

1. Spiel öffnen, einen Moment taggen, einen Clip einreihen und warten, bis der bestehende Worker ihn `ready` macht oder ein sichtbares `failed` zeigt.
2. Den Team- oder Spielerlink einer Person geben, die nicht eingeloggt ist.
3. In einem kurzen Gespräch festhalten: Kam der Clip an? War der Anfang nah genug am Moment? Würde die Person das beim nächsten Spiel wieder tun?

Erfolg ist ein Ja auf die dritte Frage, kein Umsatz. Der Test braucht kein Mac-Feature und keine neue Zahlungsintegration. Er beantwortet nicht, ob andere Vereine zahlen würden.

## 5. Daten, Datenschutz, Betrieb

- **Personen auf Bild:** Spielaufnahmen können identifizierbare Personen zeigen. Ob Spieler minderjährig sind, steht im Repo nicht. Vor jedem weiteren Teilen ist das zu klären, nicht zu vermuten.
- **Rechtsseiten:** Impressum und Datenschutzerklärung lesen Betreiberdaten aus der Umgebung (`LEGAL_*` in `.env.example`). Fehlen sie, zeigen die Seiten einen Hinweis statt erfundener Daten.
- **Freigaben:** Team- und Spielerlinks sind Geheimnisse. `TEAM_SHARE_TOKEN` und Share-Tokens gehören nicht in den Client und nicht ins Repo.
- **Speicher:** Originale auf Google Drive (ADR 0008), Proxies und Clips auf dem VPS. Ein Mac-Spiel startet lokal; Backup und Browser-Kopie fehlen (Pakete 4 und 5).
- **Auswertung:** Collection-Views sind anonym gezählt (ADR 0009, Backlog P2-21): keine Cookies, keine gespeicherte IP-Adresse oder kein User-Agent. Das gilt für diesen Zählpfad, nicht pauschal für jeden Server-Log auf dem Host.
- **Betrieb:** Ingest- und Clip-Worker, ffmpeg, rclone-Mount und optional `UPLOAD_STAGING_ROOT` sind Host-Themen (`docs/ops/vps-setup.md`). `docker-compose.yml` startet den Ingest-Dienst nicht. Ob Produktion das schon tut, ist aus dem Repo nicht beweisbar.
- **Mac:** Signierte Builds und Sparkle sind im Baum beschrieben. Ein notarisiertes Build und ein Kartenimport sind hier nicht geprüft und brauchen macOS.

## Was dieser Vorschlag nicht entscheidet

- ADR 0013 bleibt Proposed, bis die entscheidungsberechtigte Person ihn annimmt.
- Ob „fertig“ der Web-Tagesloop oder der Mac-Tagesnutzen ist.
- Domain, Marke oder ein zweites Portfolio.
- Whistle-Pipeline, Auto-Kamera und volle Mac-Parität.
