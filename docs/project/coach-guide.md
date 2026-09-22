# Coach quick-start guide

The whole coach workflow in one pass: drop a recording in the watched folder, name the game
that appears, tag it live, cut the tagged moments into clips, and share those clips through
login-free links you can revoke at any time. The app is in German; this guide names each
on-screen label in quotes so you can find it.

You only need a browser. The heavy lifting - stitching the recording, making the proxy
rendition, cutting clips - runs on other machines; you drive it all from the app.

## 0. Sign in

Open the app and sign in on "Anmelden" with your coach email and password. Everything below
is coach-only; players never sign in - they watch through the secret links you hand them.

No account yet? Ask an admin for an invite code and create one on "Konto anlegen". Your
password and the light/dark "Design" live on "Einstellungen".

## 1. Drop the recording in the watched folder

A GoPro splits one game into several files at ~4 GB each. Together they form a single
continuous timeline, so the app treats a game as an ordered list of **chapter files** rather
than one video ([ADR 0002](../decisions/0002-global-game-time-offset-model.md)).

Copy the whole recording - all `GX01xxxx.MP4`, `GX02xxxx.MP4`, ... files of the game - into
the watched folder on the NAS (your admin tells you the path, e.g.
`/media/inbox/2026-05-12-vs-rot-weiss/`). Nothing else to do: the pipeline picks the folder
up, puts the chapters in order, reads the recording date and each file's length, and
registers the game in the app. Nothing is uploaded through the browser; the app only
references the files where they are.

A little later the game shows up on "Spiele" flagged "Name fehlt". Click it and give it a
"Titel" on "Spiel benennen" - that is the only thing the files cannot tell us. After
"Speichern" you are back on "Spiele"; clicking the game now opens the tagging workspace.

**Manual fallback.** If the auto-ingest is not running (for example on a laptop without the
NAS), "Neues Spiel" on "Spiele" does the same by hand: enter "Titel", optionally "Gegner" and
"Datum", then under "Kapiteldateien" add each chapter with "Kapitel hinzufügen", giving its
"Dateipfad" and "Dauer (Sekunden)". Add the chapters **in playing order**; the duration is
what stitches them into one timeline, so enter it accurately. Save with "Spiel anlegen".

## 2. Mark the quarters (optional, recommended)

The tagging workspace is a full-screen player: the video in the middle, a thin icon rail on
the left ("Spiele" / "Tagging" / "Teilen"), the tag buttons under the video, and the tag
list on the right. The top bar shows the game and the current chapter ("Kapitel 2/4").

Open "Viertel" under the timeline before you start tagging. Play to the first push-out and
press "Start setzen" on "1. Viertel", then repeat for the other quarters and finish with
"Viertel speichern". From then on the player clock reads in match time (0:00 at the first
quarter, not the raw offset into the recording), the quarters are drawn on the timeline, and
"Zum Viertel springen" jumps straight to any quarter.

## 3. Tag moments live with hotkeys

Play through the game; click the video once so it has keyboard focus, then press a key to
tag the moment you are watching - no need to pause. Each tag captures a clip window around
that instant automatically (goals get a longer lead-in to catch the build-up). The same four
buttons sit under the video ("Tag-Tasten") if you prefer the mouse.

| Key | Moment       | Label (in app)    |
| --- | ------------ | ----------------- |
| `t` | Goal         | "Tor"             |
| `e` | Short corner | "Ecke kurz"       |
| `g` | Good action  | "Aktion gut"      |
| `s` | Bad action   | "Aktion schlecht" |

After each press you get a confirmation like "Tor bei 12:04 getaggt", the tag appears in
the "Tags" list on the right, and a marker lands on the timeline. Select a tag in the list
to open its detail panel, where you can:

- **"Bearbeiten"** - retype it ("Tag-Typ") or trim its window: "Start: Jetzt" and
  "Ende: Jetzt" take the current playback position, "Ende zurücksetzen" goes back to the
  type's default window ("Standard"). "Speichern" to keep the change.
- **"Löschen"** - remove a mis-tag (asks "Wirklich löschen?").
- **"Spieler"** - link the players involved and set the tag's "Sichtbarkeit":
  - **"Team-weit"** - the clip belongs to the whole team and appears on the team link.
  - **"Einzeln"** - the clip is private to the named players and appears only on each of
    their personal links. An "Einzeln" tag must name at least one player, otherwise its clip
    is reachable through no link at all.

Playback shortcuts while you work: `Space` play/pause, `Left`/`Right` skip 10 s,
`Shift+Left`/`Shift+Right` step 1 s (pauses on a still frame), `B`/`N` step a single frame
back/forward, `Up`/`Down` faster or slower (0,25x / 0,5x / 1x / 2x / 4x - the two slow steps
are the slow motion for close analysis), and `,` / `.` jump to the previous / next tagged
marker. The same steps sit on the transport bar: the chevrons next to the play button are the
frame steps, and the speed button cycles the whole ladder.

### Tagging in fullscreen

To watch the game properly rather than work the workspace, press `f` (or the fullscreen
button at the right of the tag buttons). The video fills the screen and the rails, top bar
and timeline drop away; the match clock stays in the corner. Every key above keeps working,
so you tag exactly as before - only now the confirmation ("Tor bei 12:04 getaggt") reads
back over the picture, because the tag list is off screen.

The exit button and the tag keys fade out after a moment of stillness and come back on the
next key press or mouse move. `Esc` or `f` returns to the workspace, where every tag you
made is waiting in the list.

## 4. Cut the clips

A tag is only a marked window until you cut it into a shareable file. "Clips schneiden" in
the top bar queues a cut for every tag that does not have one yet ("3 Clips schneiden");
the detail panel of a single tag has its own "Clip schneiden". A status pill on each tag
tracks the job:

- **"In Warteschlange"** / **"Wird geschnitten"** - the cut-worker has the job.
- **"Bereit"** - the clip is cut and now reachable through its links.
- **"Fehlgeschlagen"** - use "Erneut schneiden" on that tag to re-queue it.

Progress appears without reloading. A tag that already has a live clip shows its status
instead of cutting a duplicate. Fix the window or the players _before_ cutting: a clip is
cut from the tag's window at that moment.

## 5. Share the links

Where a ready clip shows up follows the visibility you set in step 3. All links are
login-free playlists with a "Präsentationsmodus" button for the team session (fullscreen,
big next button).

- **Team link** - all "Team-weit" clips of every game. Copy it from "Team-Link" at the top
  of "Kader" and send it to the team. (If the field says the link is disabled, the server's
  `TEAM_SHARE_TOKEN` is unset - ask an admin to configure it.)
- **Player link** - a player's own "Einzeln" clips plus every team clip. Copy it from that
  player's "Freigabelink" on "Kader". Players are added to the roster by an admin; there is
  no self-service sign-up for them.
- **Collection link** - a hand-picked playlist across games, e.g. "Standards Woche 3". On
  "Sammlungen" ("Teilen" in the workspace rail) enter a "Name der Sammlung" and press
  "Sammlung anlegen", then tick the ready clips under "Clips auswählen" and press
  "Sammlung speichern". Copy its "Geheimer Link". Clips marked "spielerbezogen" are
  "Einzeln" clips; put them in a collection only if everyone who gets the link may see them.

Anyone with a URL can watch, so treat every link as a secret. The pages are kept out of
search indexes, and one player's private clips never appear on another player's link.

Every clip carries a comment thread. On the team and player links it sits under the player
and follows the clip being watched; viewers type a name and a comment, no account needed. You
read and answer the same thread from the tagging workspace: select the tag and open
"Kommentare" in its detail panel. A link can only ever comment on the clips it can play;
collection links have no thread.

## 6. Rotate or revoke a link

If a link leaks or a player leaves, invalidate it:

- **Player link.** On "Kader" use "Link zurücksetzen" next to that player's link and
  confirm. A new link is issued and **the old one stops working immediately** - re-share the
  new one with anyone who should still have access.
- **Collection link.** Open the collection on "Sammlungen" and use "Link zurücksetzen"; the
  same rule applies. "Sammlung löschen" retires the link for good and keeps the clips.
- **Erase a player.** "Spieler löschen" on "Kader" removes the person, their own clips and
  their links; it cannot be undone.
- **Team link.** An admin changes `TEAM_SHARE_TOKEN` on the server; the old team URL stops
  working once it changes.

## Where to go next

- The product in one page: [README](../../README.md).
- Why one game is many files on a single timeline:
  [ADR 0002](../decisions/0002-global-game-time-offset-model.md).
- Running the whole system locally: [local development](../ops/local-development.md).
