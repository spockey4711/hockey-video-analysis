# Coach quick-start guide

The whole coach workflow in one pass: add a recorded game, tag it live, cut the tagged moments into clips, and share those clips through
login-free links you can revoke at any time. The app is in German; this guide names each
on-screen label in quotes so you can find it.

You only need a browser. The heavy lifting - making the lighter playback copy, cutting
clips - runs on the server; you drive it all from the app.

## 0. Sign in

Open the app and sign in on "Anmelden" with your coach email and password. Everything below
is coach-only; players never sign in - they watch through the secret links you hand them.

No account yet? Ask an admin for an invite code and create one on "Konto anlegen". Your
password, the light/dark design and signing out live on "Einstellungen" (see
[section 7](#7-your-account-and-the-design)).

## 1. Add the game

A GoPro splits one game into several files at ~4 GB each. Together they form a single
continuous timeline, so the app treats a game as an ordered list of **chapter files** rather
than one video ([ADR 0002](../decisions/0002-global-game-time-offset-model.md)). Nothing is
uploaded through the browser; the app only references the files where they are stored.

On "Spiele", open "Neues Spiel": enter "Titel", optionally "Gegner" and "Datum", then under
"Kapiteldateien" add each chapter with "Kapitel hinzufügen", giving only its "Dateipfad"
(your admin tells you where the files live). Add the chapters **in playing order** -
`GX01xxxx.MP4`, `GX02xxxx.MP4`, ... The "Dauer" of each chapter is read from the file itself
as soon as the path is entered, from the same address the player loads it from; if the row
says "Datei nicht gefunden oder nicht abspielbar", the path is wrong or the file is not
reachable yet. Save with "Spiel anlegen".

**Upload to Google Drive and you are done.** The originals live on the shared Google Drive, one
folder per game. Upload a game's chapter files into a **new** folder directly under the shared
root - nothing else needs doing, and nothing needs entering in the app. A part is one of the
files the server recognises as a chapter: an exported `halbzeit<N>` or `viertel<N>` file, or a
GoPro chapter (`GX...`/`GH...`). Anything else you put in the folder (a goal clip, a screenshot)
is ignored. The server checks the Drive root every couple of minutes and picks up a folder once
its upload has been quiet for a while, so give a big upload time to finish before you expect the
game to show up.

The game only appears under "Neu eingegangen" once **every** chapter is ready: the server has to
read each part's length and recording date, and make its playback copy, before you can review it.
A game with one slow-uploading or slow-to-process chapter simply waits a little longer - there is
nothing to do but let it finish. If the recording date could not be read reliably, "Datum" is
empty in the review and you are asked to fill it in.

**Review imported games.** A game that arrives automatically (from Google Drive, or entered by
hand) waits under "Neu eingegangen" at the top of "Spiele" instead of joining your games right
away. Open it with "Prüfen": check that the chapters are complete and in playing order and that
the "Datum" is right, then enter "Titel" and optionally "Gegner" and press "Übernehmen" - the game
moves into your list and is ready to tag. A folder uploaded by mistake goes with "Spiel
verwerfen" and a second click on "Endgültig verwerfen": this removes the game and its chapter
references from the app, while the video files themselves stay where they are.

**Late chapters, renamed folders and discarded games.** If a chapter is still uploading when the
rest of the folder goes quiet, the game can appear with a chapter missing; once the last chapter
finishes uploading it is added to the game automatically, as long as you have not accepted it yet
and the new chapter belongs after the existing ones. A chapter that arrives out of order, or after
you have already accepted the game, needs an admin's help. Renaming or moving a game's folder on
Drive after it was picked up does not re-import it - the game keeps the chapters it already has,
and the renamed folder is not treated as a second game, so avoid renaming a folder once its game
has appeared. A game you discard with "Spiel verwerfen" also stays discarded: the same folder is
not imported again on its own, even under a new name; ask an admin if a discarded game should come
back.

## 2. Mark the quarters (optional, recommended)

The tagging workspace is a full-screen player: the video in the middle, a thin icon rail on
the left ("Spiele" / "Tagging" / "Bericht" / "Teilen"), the tag buttons under the video, and
the tag list on the right. The top bar shows the game and the current chapter ("Kapitel 2/4").

Open "Viertel" under the timeline before you start tagging. Each quarter has a "Start" and an
"Ende" button that sets that boundary to the current game time. Play to the first push-out and
press "Start" on "1. Viertel"; if the recording runs through the break, play on to the final
whistle and press "Ende", then "Start" on "2. Viertel" once play resumes. Repeat for the other
quarters and finish with "Viertel speichern" (it stays disabled with a hint while the marks are
out of order or overlap). From then on the player clock reads in match time (0:00 at the first
quarter, not the raw offset into the recording), the quarters are drawn on the timeline, and
the arrow next to a quarter jumps straight to its start.

Once a quarter's end is marked, playback skips the break after it: when the video reaches that
end it jumps straight to the next quarter's start, even across chapter files. A paused player is
never moved, so you can still scrub or step through a break frame by frame; pressing play there
jumps on to the next quarter. The "x" next to an end
removes it, and the quarter then runs on to the next start again.

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

- **"Bearbeiten"** - retype it ("Tag-Typ") or trim the clip to exactly the frames you
  want. Each tag starts with its type's default window (a goal: 10 s before the key press,
  5 s after), which rarely fits every scene. For "Start" and "Ende", "Jetzt" takes the
  current playback position and the arrows either side move that edge 1 s earlier or later
  and park the video on the new frame, so you see exactly where the clip will begin or end.
  "Länge" shows the resulting clip length; "Ende zurücksetzen" goes back to the type's
  default end ("Standard"). "Speichern" to keep the change. If the tag already has a clip,
  saving a new window cuts it again: it shows as being cut for a moment, then plays the new
  window everywhere it is used - collections, the team link and player links - with its
  comments kept.
- **"Löschen"** - remove a mis-tag (asks "Wirklich löschen?").
- **"Spieler"** - link the players involved (from your roster on "Kader", see
  [section 5](#5-share-the-links)) and set the tag's "Sichtbarkeit":
  - **"Team-weit"** - the clip belongs to the whole team and appears on the team link.
  - **"Einzeln"** - the clip is private to the named players and appears only on each of
    their personal links. An "Einzeln" tag must name at least one player, otherwise its clip
    is reachable through no link at all.

Playback shortcuts while you work follow the YouTube convention: `Space` play/pause,
`Left`/`Right` skip 5 s, `J`/`L` skip 10 s, `Shift+Left`/`Shift+Right` step 1 s (pauses on a
still frame), `B`/`N` step a single frame back/forward, `Up`/`Down` faster or slower
(0,25x / 0,5x / 1x / 2x / 4x - the two slow steps are the slow motion for close analysis),
and `,` / `.` jump to the previous / next tagged marker. The same steps sit on the transport
bar: the chevrons next to the play button are the frame steps, the rewind and fast-forward
buttons do the 10 s skip, and the speed button cycles the whole ladder.

### Tagging in fullscreen

To watch the game properly rather than work the workspace, press `f` (or the fullscreen
button at the right of the tag buttons). The video fills the screen and the rails, top bar
and timeline drop away; the match clock stays in the corner. Every key above keeps working,
so you tag exactly as before - only now the confirmation ("Tor bei 12:04 getaggt") reads
back over the picture, because the tag list is off screen.

The exit button and the tag keys fade out after a moment of stillness and come back on the
next key press or mouse move. `Esc` or `f` returns to the workspace, where every tag you
made is waiting in the list.

### Drawing on a still

To explain a run or a pass, press `d` (or the pen button next to the tag buttons, "Zeichnen").
The game pauses and a toolbar appears on the video: "Freihand", "Pfeil" and "Kreis" pick what a
drag draws, the four dots pick the colour, "Rückgängig" (or `Ctrl+Z`) takes back the last stroke
and "Alles löschen" wipes them all. "Standbild exportieren" downloads the frame with your drawing
as a PNG image (named after the match clock, e.g. `standbild-v2-12-04.png`) that you can send on.

A drawing belongs to the frame it was made on: playing on, skipping or stepping a frame removes
it. `Esc`, `d` or the close button ("Zeichnen beenden") put the toolbar away. Drawing works in
fullscreen too, and the controls stay visible for as long as the toolbar is up.

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
  player's "Freigabelink" on "Kader". You set up the roster yourself on "Kader": under
  "Spielerin oder Spieler hinzufügen" enter a "Name" (and optionally a "Rückennummer",
  1 to 99) and press "Hinzufügen" - the new player appears in the list with their own
  link right away. "Bearbeiten" on a player changes their name or number; their link stays
  the same. Players never sign up themselves.
- **Collection link** - a hand-picked playlist across games, e.g. "Standards Woche 3". On
  "Sammlungen" ("Teilen" in the workspace rail) enter a "Name der Sammlung" and press
  "Sammlung anlegen", then tick the ready clips under "Clips auswählen" and press
  "Sammlung speichern". Copy its "Geheimer Link". Clips marked "spielerbezogen" are
  "Einzeln" clips; put them in a collection only if everyone who gets the link may see them.
  Unlike the team and player links, a collection never plays on its own: each clip waits
  for a play press, stops at its end, and offers "Nochmal abspielen" or "Nächster Clip".

Anyone with a URL can watch, so treat every link as a secret. The pages are kept out of
search indexes, and one player's private clips never appear on another player's link.

Every clip carries a comment thread. On the team and player links it sits under the player
and follows the clip being watched; viewers type a name and a comment, no account needed. You
read and answer the same thread from the tagging workspace: select the tag and open
"Kommentare" in its detail panel. A link can only ever comment on the clips it can play;
collection links have no thread.

A comment you post while signed in (from the tagging workspace, or from a share link opened in
the browser you are signed in with) is your highlighted comment: it is pinned at the top of the
clip's thread with a "Trainer" badge, on the team and player links, in the tagging workspace and
in "Auswertung". On a collection link, your most recent comment on a clip shows under the clip
title, in the playlist and in the presentation mode, cut to two lines. Viewers of a link can
never post one, whatever name they type.

To see how a collection lands, open it on "Sammlungen" and read "Auswertung" above the clip
checklist. It shows, for the whole collection and for each clip, the "Klicks" (a clip was
started), "Ganz angesehen" (at least 90 % of a clip was actually played), "Wiederholt" (a clip
was started again after it ended) and "Zuschauer (pro Tag)". Viewers are counted per day and
anonymously, so someone who watches on three days counts three times; read it as a
rough audience size, not a head count. Only the collection link is counted, and only for the
last 365 days. Under each clip you also see all of its comments (name, text, time), read-only,
with your own highlighted comments pinned first; answer them from the tagging workspace as above.

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

## 7. Your account and the design

"Einstellungen" in the top bar is your own corner of the app:

- **Konto** shows the name and email you signed up with. They are read-only for now; ask an
  admin if one of them is wrong.
- **Passwort ändern** takes your "Aktuelles Passwort", a "Neues Passwort" of at least 8
  characters and the same again under "Neues Passwort bestätigen". After the change you stay
  signed in on this device, but **every other device and browser is signed out** and has to
  sign in again with the new password - so this is also the move if you think someone else
  knows your password. Several wrong current passwords in a row lock the form for a while.
- **Darstellung** switches between the dark and the light design; the choice sticks in this
  browser. The sun/moon button in the top bar does the same.
- **Sitzung** signs you out on this device, like "Abmelden" in the top bar.

### Impressum and Datenschutz

Every page, including login and the share links, links "Impressum" (`/impressum`) and
"Datenschutz" (`/datenschutz`) in its footer; both are public. The operator's details come
only from the server environment, never from the repo: an admin sets `LEGAL_OPERATOR_NAME`,
`LEGAL_OPERATOR_STREET`, `LEGAL_OPERATOR_CITY` and `LEGAL_CONTACT_EMAIL`, and optionally
`LEGAL_CONTACT_PHONE` and `LEGAL_HOSTING_PROVIDER` (see `.env.example`). While a required one
is unset, the pages show a notice instead. The texts are a draft: have them checked before
relying on them.

## 8. Read the game report

"Bericht" in the workspace rail opens the game's "Spielbericht": the key figures counted from
the tags you set - nothing extra to capture. The tiles at the top show how many "Tor",
"Ecke kurz", "Aktion gut" and "Aktion schlecht" the game has, plus "Tags gesamt".

- **"Nach Viertel"** splits the figures by quarter once you have marked them (step 2); tags
  before the first quarter or in a break land under "Außerhalb der Viertel".
- **"Nach Spieler"** counts each player's linked tags (step 3, "Spieler"). A tag with several
  players counts for each of them, so this table can add up to more than the game total;
  tags with no player sit under "Ohne Spieler".

"CSV exportieren" downloads the same figures as one table (`spielbericht-<date>-<title>.csv`)
that opens directly in Excel, one row per slice of the game ("Bereich": Spiel, Viertel,
Spieler). "Zum Tagging" takes you back to the workspace. The report is coach-only, like
everything but the share links.

## 9. Compare games in the team overview

"Berichte" in the top bar opens the "Teamübersicht": the same key figures, summed over all
games. "Nach Spiel" lists every game with its figures; click a game's name to open its own
report. "Nach Spieler" adds up each player's figures over the games shown.

To look at part of the season, set "Von" and/or "Bis" and click "Anwenden"; "Zurücksetzen"
shows all games again. A date range only counts games that have a date, so give each game its
date when you add it (step 1). The address of the page keeps the range, so you can bookmark
it or send it to another coach.

"CSV exportieren" downloads the overview for the same range (`teambericht.csv`, or e.g.
`teambericht-ab-2026-01-01-bis-2026-03-31.csv`), one row per slice ("Bereich": Team, Spiel,
Spieler), with each game's date and opponent in their own columns.

## Where to go next

- The product in one page: [README](../../README.md).
- Why one game is many files on a single timeline:
  [ADR 0002](../decisions/0002-global-game-time-offset-model.md).
- Why the originals live on Google Drive:
  [ADR 0008](../decisions/0008-google-drive-holds-originals.md).
- Running the whole system locally: [local development](../ops/local-development.md).
