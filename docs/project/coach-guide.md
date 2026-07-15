# Coach quick-start guide

The whole coach workflow in one pass: get a game into the portal, tag it live, turn
confirmed moments into clips, and share those clips through login-free links you can revoke
at any time. The app is in German; this guide names each on-screen label in quotes so you
can find it.

You only need a browser. The heavy lifting - detecting whistles and cutting the video -
runs on other machines; you drive it all from the tagging workspace.

## 0. Sign in

Open the app and sign in on "Anmelden" with your coach email and password. Everything below
is coach-only; players never sign in - they watch through the secret links you hand them.

No account yet? Ask an admin for an invite code and create one on "Konto anlegen".

## 1. Reference a game's chapter files

A GoPro splits one game into several files at ~4 GB each. Together they form a single
continuous timeline, so the app treats a game as an ordered list of **chapter files** rather
than one video. See [ADR 0002](../decisions/0002-global-game-time-offset-model.md) for why
one game-time coordinate runs through the whole system.

On "Spiele" choose "Neues Spiel" and fill in:

- **"Titel"** and, optionally, **"Gegner"** and **"Datum"**.
- Under "Kapiteldateien", add each file with "Kapitel hinzufügen":
  - **"Dateipfad"** - the path where the file already lives on the NAS
    (e.g. `/media/2026-05-12-vs-rot-weiss/GX010123.MP4`). This only _references_ the file;
    nothing is re-uploaded.
  - **"Dauer (Sekunden)"** - the file's length in seconds. This is what stitches the
    chapters into one timeline, so enter it accurately.
- Add the chapters **in playing order** (first half before second half, and so on).

Save with "Spiel anlegen". The game now opens as one continuous player.

## 2. Tag moments live with hotkeys

Click the game on "Spiele" to open its tagging workspace. Play through the game;
click the player once so it has keyboard focus, then press a key to tag the moment you are
watching - no need to pause. Each tag captures a clip window around that instant
automatically (goals get a longer lead-in to catch the build-up).

| Key | Moment       | Label (in app)    |
| --- | ------------ | ----------------- |
| `t` | Goal         | "Tor"             |
| `e` | Short corner | "Ecke kurz"       |
| `g` | Good action  | "Aktion gut"      |
| `s` | Bad action   | "Aktion schlecht" |

After each press you get a confirmation like "Tor bei 12:04 getaggt". Every tag shows up in
the "Erfasste Tags" panel, where you can jump to it, fine-tune its start/end
("Start: Jetzt" / "Ende: Jetzt"), retype it, or delete it.

**Link players to a tag.** On a tag row, open "Spieler" to pick the players involved and set
its visibility:

- **"Team-weit"** - the clip belongs to the whole team and appears on the team link.
- **"Einzeln"** - the clip is private to the named players and appears only on each of
  their personal links. An "Einzeln" tag must name at least one player, otherwise its clip is
  reachable through no link at all.

Playback shortcuts while you work: `Space` play/pause, `Left`/`Right` skip 10s,
`Shift+Left`/`Shift+Right` step one frame, `Up`/`Down` scan at 2x/4x, and `,` / `.` jump
between tagged markers. The full list is in the "Tastenkürzel" panel.

## 3. Confirm whistle suggestions

The pipeline listens for the double whistle that signals a goal and offers each hit as a
**goal suggestion** ("Torvorschlag") in the "Torvorschläge" panel. Nothing is applied
automatically - you decide:

- "Zur Stelle springen" - jump the player to the candidate and check it.
- "Als Tor bestätigen" - confirm it, which creates a "Tor" tag at that moment.
- "Verwerfen" - reject it.

Confirming is just a faster way to place goal tags you would otherwise add by hand; you can
still tag goals manually with `t`.

## 4. Cut and share clips

A tag is only a marked window until you cut it into a shareable file. In the
"Clips schneiden" panel, each tag has a "Clip schneiden" control that queues the cut. A
status pill tracks the job:

- **pending / processing** - the cut-worker has the job.
- **ready** - the clip is cut and now reachable through its link.
- **failed** - use "Erneut schneiden" to re-queue it.

The panel polls while cuts are in flight, so progress appears without reloading. A tag that
already has a live clip shows its status instead of cutting a duplicate.

Where a ready clip shows up follows the visibility you set in step 2:

- **Team link** - all "Team-weit" clips, as one playlist. Copy it from the "Team-Link"
  field on "Kader" and send it to the team. (If the field says the link is disabled, the
  server's `TEAM_SHARE_TOKEN` is unset - ask an admin to configure it.)
- **Player link** - each player's own "Einzeln" clips (plus the team clips they are in).
  Copy it from that player's "Freigabelink" on "Kader".

Both links are login-free: anyone with the URL can watch, so treat them as secrets. They are
kept out of search indexes, and one player's private clips never appear on another's link.

## 5. Rotate or revoke a link

If a link leaks or a player leaves, invalidate it from "Kader":

- **Rotate a player link.** Use "Link zurücksetzen" on that player and confirm. A new link is
  issued and **the old one stops working immediately** - re-share the new link with anyone who
  should still have access.
- **Erase a player.** Deleting a player from the roster removes them and their data, which
  also retires their link.

To rotate the **team** link, an admin changes the `TEAM_SHARE_TOKEN` on the server; the old
team URL stops working once it changes.

## Where to go next

- The product in one page: [README](../../README.md).
- Why one game is many files on a single timeline:
  [ADR 0002](../decisions/0002-global-game-time-offset-model.md).
- Running the whole system locally: [local development](../ops/local-development.md).
