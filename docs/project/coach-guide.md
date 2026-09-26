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
password, the team's game format, the design, the presentation text size and signing out live
on "Einstellungen" (see [section 7](#7-your-account-and-the-design)).

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

**Spielformat.** A new game plays the team's format, 4 x 15 minutes unless you changed it under
"Einstellungen > Spiel". For an indoor game, a youth game or a friendly with other rules, pick
"Eigenes Format" under "Spielformat" and set "Abschnitte" ("4 Viertel" or "2 Halbzeiten") and
"Minuten je Abschnitt". The format decides how many periods you mark (step 2), where the match
clock stands at each one and how the report splits the game (step 8). You can change it later
with "Format" in the workspace rail; a game that switches from quarters to halves loses the
marks of its 3rd and 4th quarter, and the form says so before you save.

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
the left ("Spiele" / "Tagging" / "Bericht" / "Format" / "Teilen"), the tag buttons under the
video, and
the tag list on the right. The top bar shows the game and the current chapter ("Kapitel 2/4").

Open "Viertel" under the timeline before you start tagging. Each quarter has a "Start" and an
"Ende" button that sets that boundary to the current game time. Play to the first push-out and
press "Start" on "1. Viertel"; if the recording runs through the break, play on to the final
whistle and press "Ende", then "Start" on "2. Viertel" once play resumes. Repeat for the other
quarters and finish with "Viertel speichern" (it stays disabled with a hint while the marks are
out of order or overlap). From then on the player clock reads in match time (0:00 at the first
quarter, not the raw offset into the recording, and 15:00 at the second in a 4 x 15 game), the
quarters are drawn on the timeline, and the arrow next to a quarter jumps straight to its start.
A game of two halves works the same way under "Halbzeiten": two rows, "H1" and "H2" on the
timeline, and in a 2 x 20 game the second half starts at 20:00 on the clock.

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
still frame), `B`/`N` step a single frame back/forward (one frame of the recording: 1/50 s
on 50 fps footage, 1/25 s on 25 fps), `Up`/`Down` faster or slower
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
The game pauses and a toolbar appears on the video: "Freihand", "Pfeil", "Kurvenpfeil" and
"Kreis" pick what a drag draws, the four dots pick the colour, and the three bars pick the stroke
width ("Dünn", "Mittel", "Dick"; `w` steps through them). The width applies to the next stroke, so
lines you already drew keep theirs, and the app remembers your choice for the next game. Arrows
are drawn slightly see-through with a compact head, so the players they run across stay visible.

For the path of a Schlenzer or any bent ball path, pick "Kurvenpfeil" (or press `k`) and drag
from where the ball starts to where it lands, bowing the drag the way the ball bends: the arrow
curves through the widest point of your drag and its head follows the bend. The button with
three dots, "Gepunktet" (or `o`), switches to dotted lines, handy to set a pass or the ball's
path apart from a solid run. It works for every tool and, like the width, applies to the next
stroke, so the lines you already drew keep their style.
"Rückgängig" (or `Ctrl+Z`) takes back the last stroke and "Alles löschen" wipes them all. "Standbild exportieren" downloads the frame with your drawing
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
login-free playlists with a "Präsentationsmodus" button for the team session. It gives almost
the whole screen (native fullscreen where the browser allows it) to the clip: a slim line on
top with the clip title and the way out ("Präsentation beenden", or `Esc`), and a compact row
below with previous, play, "Nächster Clip", the pen button, the pointer button, the board
button, the text size button and the clip counter. The arrow keys
step through the clips. To explain a moment, pause and press `d` (or the pen button, "Zeichnen"):
you get the same drawing tools, colours, stroke widths and line styles as on a still in the tagging workspace
(see "Drawing on a still" above), without the still export. A drawing stays in your browser
only - it is never saved or sent - and disappears as soon as the clip plays on or you move to
another clip. While you draw, the first `Esc` puts the drawing away; in fullscreen the browser
also leaves fullscreen then, and the presentation stays open in the window until the next
`Esc` or "Präsentation beenden". To point at a player without drawing, press `p` (or the
pointer button, "Laserpointer"): a bright glowing dot follows your mouse or finger over the
video in place of the cursor, while the clip plays or stands still. It leaves nothing behind
and stays on across clips until you press `p` again. Pointer and pen never run together:
switching one on puts the other away.

To explain a move on a board, press `t` (or the board button, "Taktiktafel"): the tactics board
comes up over the whole presentation with the clip paused under it, starting on the lineup of
eleven a side. It works like the board on "Taktik" (see "Set up a scene on the tactics board"
below), with the same tools, keys and animation bar. "Tafel" switches to an empty pitch, and on
a collection link opened in the browser you are signed in with, to any of your saved scenes, so
a scene you prepared before the session is one pick away. Nothing on this board is saved.
`t` again, `Esc` or "Zurück zur Präsentation" puts it away, and the presentation carries on
from the same clip and moment; open the board again and it is as you left it, until the
presentation closes.

The presentation's text - the clip title and your comment, the title cards, your notes and the
counter - grows with the screen by itself, so it reads from the back of the room on a big TV or
projector. If that is still too small, the text size button (the "Aa" button) steps it through
"Normal", "Groß" and "Sehr groß"; the same choice is "Textgröße in der Präsentation" under
"Einstellungen" > "Darstellung". It sticks in this browser, so set it once on the clubhouse
laptop. The browser's own text size applies on top, in the presentation and everywhere else.

- **Team link** - all "Team-weit" clips of every game. Copy it from "Team-Link" at the top
  of "Kader" or under "Einstellungen" > "Teilen" and send it to the team. If there is no link
  yet, the team view is off: press "Team-Link erzeugen" under "Einstellungen" > "Teilen".
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
  A clip that is being cut again after you changed its window leaves the list until it is
  ready; saving the collection in the meantime keeps it in the collection, with its texts
  and notes.
  Unlike the team and player links, a collection never plays on its own: each clip waits
  for a play press, stops at its end, and offers "Nochmal abspielen" or "Nächster Clip".
  It plays in the app's own player, starting exactly at the tag's start (or your trim, see
  below) rather than up to a second early as the cut file does; under the picture sit play,
  single-frame steps, a scrub bar, sound and "Vollbild". On an iPhone, "Vollbild" fills the
  browser window instead of the screen. The clip files themselves are not offered for
  download there.

To change how long each clip plays in a collection, press "Im Editor bearbeiten" on the
collection's page on "Sammlungen" (or "Bearbeiten" beside one clip); the "Clip-Editor" opens in
its own tab, so the tagging workspace can stay open beside it. Pick a clip on the left, then drag
the two handles on the track under the player, or move to a frame and press "Start hier setzen"
or "Ende hier setzen" (the keys `I` and `O`). The small arrows beside them move a point by a
single frame, and "Ganze Länge" plays the whole clip again. Space plays, `B` and `N` step a
frame. Every change is saved a moment after you make it ("Gespeichert" in the header); if the
same clip was changed in another tab meanwhile, the editor says so and "Neu laden" fetches that
version. A shortened clip plays that way only in this collection, on its link and in the
"Präsentationsmodus"; the team link, the player links and other collections keep the full clip.
To show more than the clip holds, press "Mehr Vorlauf" or "Mehr Nachlauf" (2 seconds each): that
widens the tag's window and cuts the clip again, for every link, exactly as trimming on the
watch page does. While it is cut, which usually takes a few seconds, the clip is on no link and
the editor waits with it; "Link ansehen" opens the collection link to check the result.

Under "Länge" the editor has two more tracks. On "Zeitlupe", drag across the track over the
moment you want slowed down (or press "Zeitlupe ab hier" for two seconds from the playhead),
then pick "0,5x" or "0,25x"; a chosen stretch shows handles to move its start and end, and
"Zeitlupe entfernen" takes it out. Slow motion plays without sound. On "Zoom", move to a moment
and press "Zoom hier setzen": the picture shows whole with a frame on it, and you drag the frame
to the part to show, pull a corner to zoom further in or out (the frame keeps the picture's
shape, at most 5x), or drag a new frame across the picture; the arrow keys move a focused frame
and `+` and `-` zoom. One such zoom point holds for the whole clip. Add more to change the view
during the clip: each point either holds its picture until the next ("Halten") or glides to it
("Gleitend"), and "Ganzes Bild" zooms back out. Playing shows the result. The zoom enlarges the
clip's full-resolution picture on the viewer's screen, so it stays as sharp as the footage
allows, and slow motion and zoom play the same way on the collection link and in the
"Präsentationsmodus", on a phone too.

The last track, "Markierungen", puts drawings on the clip. Stop at the moment you want to explain
and press "Markierung hinzufügen" (or `d`): the clip pauses and the drawing toolbar from the
watch page comes up over the picture, zoom included, with every tool, colour, width and the
dotted style. Draw arrows, curved arrows, circles or lines, pick how long the marker shows
("Dauer", 1 to 8 seconds) and what the picture does meanwhile: "Bild anhalten" (the default)
freezes the picture for that time, "Läuft weiter" shows the drawing over the running clip.
"Übernehmen" puts the marker on the track at that moment, "Abbrechen" drops the drawing. Press a
marker on the track to jump to its frame and change its "Dauer" or behaviour, "Zeichnung ändern"
to open its drawing again, or "Markierung löschen". Markers stick to the pitch while the picture
zooms, and their lines keep their width. On the collection link, viewers can hide and show the
markers with the eye button ("Markierungen") in the player; in the "Präsentationsmodus", press
`m` or the same button in the toolbar. Hidden markers neither show nor freeze the picture, while
zoom and slow motion play on. The switch holds while the page is open and is not saved. Your own
drawing in the "Präsentationsmodus" always lies on top of the markers.

The editor can also fill the collection. "Clips hinzufügen" in its header lists every ready clip,
narrowed by "Spiel", "Art" and "Spieler"; "Einzeln" clips are marked "spielerbezogen", as in the
list on the collection's page. "Hinzufügen" puts a clip into the collection and selects it in the
editor, and the list stays open for the next one. A clip already in the collection shows "In der
Sammlung" instead, since each clip appears once per collection; clips play in game order, newest
game first. "Neue Sammlung" asks for a name and opens the new, empty collection in the editor. On
the watch page, a tag whose clip is ready offers "In Sammlung bearbeiten": pick a collection, or
name a new one, and the "Clip-Editor" opens in a new tab with that clip in the collection and
selected.

Clips play at full resolution on every link. So that the next clip starts without waiting, the
page loads the next two clips in the background once the current one shows its first frame;
clips already watched, or skipped past, are not kept. If the viewer's phone or browser has data
saving switched on, only the clips' basic details load ahead. Loading ahead never counts as a
view in "Auswertung".

A collection can carry two kinds of notes, and they are never mixed up: texts for the team,
which everyone with the link sees, and private presenter notes, which only you see.

To give the team something to read, open the collection on "Sammlungen" and fill in the card
"Für das Team sichtbar": an "Einleitung zur Sammlung" (what the session is about) and one short
text per clip in the collection, in the order the link plays them, then press "Texte speichern".
Each text holds up to 500 characters of plain text, line breaks included; as with the notes
below, tick and save the clips first. On the collection link the intro stands above the clips
and a clip's text shows under its title in the playlist, so players watching on their phones
read it too. In the "Präsentationsmodus" the texts come up as title cards over the video: the
intro before the first clip, then a clip's text before that clip, every time it comes up. A card
never moves on by itself: press "Weiter" (or `Enter`) to go to the next card or the clip, or play
to skip straight to the clip. A clip without a text plays exactly as before. Write nothing here
you would not show the whole team, since anyone who gets the link can read it.

Before a session you can also prepare private presenter notes for a collection. Fill in
"Präsentationsnotizen" at the bottom of the same page: a "Notiz zur Sammlung" (what the
session is about) and one note per clip in the collection, in the order the link plays them,
then press "Notizen speichern". Each note holds up to 1000 characters of plain text, line breaks
included. Only clips already saved in the collection get a field, so tick and save the clips
first. Taking a clip out of the collection deletes its note; deleting the collection deletes all
of them. To present with your notes, open the collection link in the browser you are signed in
with and start the "Präsentationsmodus": press `h` (or the notes button, "Notizen") to show "Deine
Notizen" beside the video - the collection note on the first clip, then the note of the clip
that is up. The panel starts hidden, because a projector or a shared screen usually mirrors
yours, and stays as you left it while you step through the clips; press `h` again before you
share the screen. Nobody who opens the link without being signed in ever receives the notes -
not on screen and not in the page - and the team and player links have no notes or texts.

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

To remove a rude or mistaken comment, press the bin icon on it, in the tagging workspace or in
"Auswertung", and confirm with "Löschen" ("Abbrechen" keeps it). The comment is deleted for
good, your own included, and is gone from every link the next time it is loaded. Only you can
delete comments; viewers of a link cannot delete anything, not even what they wrote.

To see how a collection lands, open it on "Sammlungen" and read "Auswertung" above the clip
checklist. It shows, for the whole collection and for each clip, the "Klicks" (a clip was
started), "Ganz angesehen" (at least 90 % of a clip was actually played), "Wiederholt" (a clip
was started again after it ended) and "Zuschauer (pro Tag)". Viewers are counted per day and
anonymously, so someone who watches on three days counts three times; read it as a
rough audience size, not a head count. Only the collection link is counted, and only for the
last 365 days. Under each clip you also see all of its comments (name, text, time), with your
own highlighted comments pinned first; answer them from the tagging workspace and delete them
here or there, as above.

## 6. Rotate or revoke a link

If a link leaks or a player leaves, invalidate it:

- **Player link.** On "Kader" use "Link zurücksetzen" next to that player's link and
  confirm. A new link is issued and **the old one stops working immediately** - re-share the
  new one with anyone who should still have access.
- **Collection link.** Open the collection on "Sammlungen" and use "Link zurücksetzen"; the
  same rule applies. "Sammlung löschen" retires the link for good and keeps the clips.
- **Erase a player.** "Spieler löschen" on "Kader" removes the person, their own clips and
  their links; it cannot be undone.
- **Team link.** Under "Einstellungen" > "Teilen" use "Neuen Link erzeugen" and confirm. The
  old team link stops working at once - also in a team page someone still has open - so this
  takes seconds from a phone if the link ends up in the wrong chat. Share the new one with
  the team.
- **Collection link end date.** A collection link can end on its own: on the collection's
  page pick a day under "Gültig bis (optional)" and press "Datum speichern". The link
  works through the end of that day and then shows "Link nicht mehr gültig"; "Sammlungen"
  marks it "Link abgelaufen". Pick a later day or use "Datum entfernen" to open it
  again with the same link - "Link zurücksetzen" keeps the end date.

## 7. Your account and the design

"Einstellungen" in the top bar is your own corner of the app:

- **Konto** shows the name and email you signed up with. They are read-only for now; ask an
  admin if one of them is wrong.
- **Passwort ändern** takes your "Aktuelles Passwort", a "Neues Passwort" of at least 8
  characters and the same again under "Neues Passwort bestätigen". After the change you stay
  signed in on this device, but **every other device and browser is signed out** and has to
  sign in again with the new password - so this is also the move if you think someone else
  knows your password. Several wrong current passwords in a row lock the form for a while.
- **Spiel** sets the team's game format: "Abschnitte" ("4 Viertel" or "2 Halbzeiten") and
  "Minuten je Abschnitt", 4 x 15 to start with. Every game without its own format plays it, so
  switch it for the indoor season and back. A game in which you have already marked periods
  keeps the format it was marked in; one game at a time is set under "Format" (step 1).
- **Teilen** holds the team link: copy it, or replace it with "Neuen Link erzeugen" (see
  step 6). Without a link yet, "Team-Link erzeugen" turns the team view on.
- **Darstellung** holds the display choices of this device; they stick in this browser.
  "Design" is "System" (follow the light or dark setting of your computer or phone, also when
  it switches in the evening), "Hell" or "Dunkel". The sun/moon button in the top bar flips
  between light and dark and keeps the one it shows; choose "System" here to follow the device
  again. "Textgröße in der Präsentation" is described under the presentation mode.
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
  before the first quarter or in a break land under "Außerhalb der Viertel". A game of two
  halves shows "Nach Halbzeit" and "Außerhalb der Halbzeiten" instead.
- **"Nach Spieler"** counts each player's linked tags (step 3, "Spieler"). A tag with several
  players counts for each of them, so this table can add up to more than the game total;
  tags with no player sit under "Ohne Spieler".

"CSV exportieren" downloads the same figures as one table (`spielbericht-<date>-<title>.csv`)
that opens directly in Excel, one row per slice of the game ("Bereich": Spiel, Viertel or
Halbzeit, Spieler). "Zum Tagging" takes you back to the workspace. The report is coach-only, like
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

## 10. Set up a scene on the tactics board

"Taktik" in the top bar opens the tactics board. Give a scene a name ("Ecke kurz Variante 2"),
choose under "Ausschnitt" whether it shows the "Ganzes Feld" (the default) or the "Kurze Ecke",
and "Szene anlegen" opens it on a field hockey pitch drawn to the official FIH measurements.
The choice is final: a scene keeps its view, so pick the short corner for a corner routine and
start a new scene for anything else. The whole field starts with both teams lined up eleven a
side (Heim in blue, Gast in red) and the ball on the centre spot. On a phone held upright the
pitch turns upright too, your own goal at the bottom.

- **Move** players and the ball by dragging them with the mouse or a finger. Or click a player
  (or reach it with `Tab`) and nudge it with the arrow keys: 0.5 m a press, 5 m with `Shift`.
  `Entf` removes it.
- **Add** players with "+ Heim" and "+ Gast"; there is no fixed number per side. A removed
  ball comes back with "+ Ball".
- **Label** a selected player in the panel under the pitch: a shirt number or a short tag of up
  to four characters ("TW", "LV"). "Spieler aus dem Kader" links the token to a player from your
  roster and takes over the shirt number.
- **Draw** with "Linie", "Pfeil" or "Kurvenpfeil": drag across the pitch, bowing the drag for a
  curved arrow. The colours, the three widths and "Gepunktet" work as when drawing on a still
  (`w` and `o` too). Back on "Bewegen", click a line to select it and remove it.
- "Rückgängig" (or `Ctrl+Z`) takes back the last change, "Alle Linien löschen" removes every line.
- **A short-corner scene** shows only the quarter of the pitch around one goal - the circle, the
  5 m dotted line, the back-line with the injection marks and the 23 m area - filling the board,
  its goal at the top (on a phone held upright, as it lies). It starts with only the ball; add
  the players you need with "+ Heim" and "+ Gast". New players and the ball appear inside the
  quarter and a drag stops at its edge. Players are drawn near to scale there, so the keeper and
  four defenders fit side by side in the goal; their numbers stay readable and may overlap when
  players stand very close. The toolbar names the scene's view, and the view is used
  wherever the scene appears: in the presentation board, in a collection and on its link.
  "Duplizieren" keeps the view too.

### Animate the scene

Under the pitch sits the animation bar. A scene starts as one arrangement, "Start"; each step you
add moves players and the ball on from there.

- **Add a step** with "+": it comes right after the step on show, and the board shows it. Drag
  the players and the ball that should move to where they end up in this step; everyone else
  stays put. A dashed trail runs from where each one started (the dashed ring) to where it
  stands now.
- **Bend a run**: select a token that moves in the step and drag the yellow dot on its trail (or
  move it with the arrow keys). "Gerade laufen" straightens it again, "Bewegung entfernen" keeps
  the token where it was.
- **Time a step** with "Dauer" (0.5 to 10 seconds for all of its runs). "Schritt löschen" removes
  the step on show with its runs and lines.
- **Lines belong to a step.** A line drawn on "Start" shows throughout; a line drawn on a step
  appears only while that step plays and while the board rests on it, so a pass arrow shows
  with its pass. With steps, the bin in the toolbar clears only the lines of the step on show.
- **Play** with the play button or the space bar: the runs glide from step to step and the board
  stops on the last step. Pause anywhere, drag the time bar to look at any moment, and use the
  step buttons (or `B` and `N`) to jump to the step before or after. The speed button cycles
  from 0.25x to 4x, and "Von vorn abspielen" starts over. Click a step, or change anything, to go
  back to editing.

Nothing is stored until you press "Speichern"; the note next to it says when there are unsaved
changes, and the browser asks before you leave the page with them. The name field renames the
scene on the same save. "Duplizieren" copies the saved scene to try a variant, and "Löschen"
removes it after asking once more. Scenes have no share link of their own. To show one to the
team, open the board in the "Präsentationsmodus" (see "Share the links" above) and pick the scene
under "Tafel", or put it into a collection.

### Put a scene into a collection

A prepared scene can play in a collection like a clip. On the collection's page, under
"Taktikszenen", pick the scene under "Szene" and press "Szene hinzufügen": it goes to the end of
the "Ablauf", the order in which the link and the "Präsentationsmodus" play the collection. The
clips stay in their order (newest game first, then by game time); move a scene up or down past
them with the arrow buttons to where it should play, and take it out with the bin. An animated
scene plays its steps and ends with its last one; a still scene ("Standbild") stays up for its
"Standzeit", 3 to 60 seconds, which you set next to it.

On the link a scene gets its own place in the playlist and plays on the pitch in the clip's place,
with the same play, pause and replay buttons; in the "Präsentationsmodus" it comes up in turn like
a clip. The link shows what is on the board - the players' labels, the ball, the lines and runs -
and the scene's name, but never which player from your roster a token stands for. The collection
always shows the scene as it is saved now: change it on "Taktik" and the change is on the link;
delete it and it leaves the collection.

## 11. Watch a game on the Mac

The Mac app "Hockey Video" plays a game straight from the SSD or the camera card, at full
quality and without any upload or sign-in. It is the start of the editing desk on the Mac; for
now it only plays, so tagging, clips and links stay on the web.

- **Open a game** with "Ordner öffnen …" (or `⌘O`) and pick the game's folder on the SSD, or the
  camera card itself: the app finds the recordings in the card's `DCIM` folder. Dragging the
  folder onto the window works too. The app picks the game's files the way the Drive import
  does: GoPro chapters in recording order, or exported halves (`halbzeit1.mp4`) or quarters
  (`viertel1.mp4`); other files in the folder are left alone.
- **One continuous game:** all chapters play as one timeline, with the game clock under the
  picture. The scrub bar marks where the footage jumps to a new recording, never the seams
  between the chapters of one recording.
- **Keys** are the ones from the web player: `Leertaste` plays and pauses, the arrows skip 5
  seconds (with `Shift` they step one second), `J` and `L` skip 10 seconds, and the up and down
  arrows set the speed from 0.25x to 4x. `F` switches to fullscreen, `Esc` leaves it. Clicking the
  picture plays or pauses.
- **Frame steps:** `B` and `N` step exactly one frame back or forward, as in the browser, also
  across the seam between two chapters.

If a folder does not open, the app says why: no game files in it, a chapter missing ("Es fehlt
Kapitel 2 der Aufnahme 0042"), or a file that cannot be played.

## Where to go next

- The product in one page: [README](../../README.md).
- Why one game is many files on a single timeline:
  [ADR 0002](../decisions/0002-global-game-time-offset-model.md).
- Why the originals live on Google Drive:
  [ADR 0008](../decisions/0008-google-drive-holds-originals.md).
- How a tactics scene is stored:
  [ADR 0010](../decisions/0010-tactics-scenes-as-versioned-json-in-pitch-metres.md), and how
  it is animated: [ADR 0012](../decisions/0012-animate-tactics-scenes-as-keyframe-steps.md), and
  how it goes into a collection:
  [ADR 0014](../decisions/0014-tactics-scenes-as-collection-entries.md).
- Running the whole system locally: [local development](../ops/local-development.md).
