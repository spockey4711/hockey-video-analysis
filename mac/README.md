# Hockey Video for the Mac

The coach's editing desk as a native SwiftUI app ([ADR 0013](../docs/decisions/0013-native-mac-app-is-the-coachs-editing-desk.md)):
games straight from the camera card or the SSD, at full quality and without network traffic.
The [Mac app plan](../docs/project/mac-app-plan.md) lists the slices. So far the app plays a game
folder as one continuous game (M1), ships as a signed build that updates itself (M2), tags a
whole game offline, with its tags and quarters kept in a local store (M3), signs in to the
server and syncs its games, tags, players and quarters with the web (M4), imports a game
straight from the camera card (M5), and cuts and uploads the clips of its games (M6).

## Layout

| Path                                | What it holds                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------ |
| `HockeyKit/`                        | A Swift package with all logic, fully unit-tested                                    |
| `HockeyKit/Sources/HockeyCore/`     | Pure rules ported from the web's TypeScript, pinned by [`contracts/`](../contracts/) |
| `HockeyKit/Sources/HockeyMedia/`    | AVFoundation: reading a game folder, the game's composition, the player, the cutter  |
| `HockeyKit/Sources/HockeyStore/`    | The local store (SQLite through GRDB) and the tagging desk the views bind to         |
| `HockeyKit/Sources/HockeySync/`     | Sign-in, the app API client, push and pull, the merge, the clip cutting and upload   |
| `HockeyVideo/HockeyVideo.xcodeproj` | The app project; its sources are a buildable folder, so new files never touch it     |
| `HockeyVideo/HockeyVideo/`          | The app target: SwiftUI views only, German copy in `Localizable.xcstrings`           |
| `HockeyVideo/HockeyVideo.xcconfig`  | Target settings outside the project file: the update key, the local signing include  |
| `HockeyVideo/Info.plist`            | The updater's settings (feed, key, daily checks), merged into the generated plist    |
| `Local.xcconfig.example`            | Your own signing values; copy it to the gitignored `Local.xcconfig`                  |
| `scripts/`                          | Scripts the release workflow runs                                                    |

Rules live in `HockeyKit`, never in a view. A rule the web app also has is a port: its golden
vectors come first (`contracts/README.md`), and its Swift tests read them.

## Requirements

macOS 26 and Xcode 26 (Swift 6.2 or newer). Two package dependencies:
[GRDB](https://github.com/groue/GRDB.swift) for the local store (`HockeyKit/Package.resolved`
pins it for `swift test`) and [Sparkle 2](https://sparkle-project.org) for updates. Xcode fetches
both at the versions `HockeyVideo.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved`
pins.

## Test

```bash
cd mac/HockeyKit
swift test -Xswiftc -warnings-as-errors
```

The rule tests read `contracts/vectors/*.json` from this checkout, so a rule changed in the
TypeScript fails here until the port follows. The app ships `contracts/tag-types.json` as a copy
in `HockeyCore/Resources/`; a test fails when the two differ, and the fix is to copy the file over. The media tests write short synthetic chapters into
a temporary folder; no footage is ever committed.

## Build and run

Open `mac/HockeyVideo/HockeyVideo.xcodeproj` in Xcode and run the `HockeyVideo` scheme, or build
from the command line the way CI does:

```bash
xcodebuild build -project mac/HockeyVideo/HockeyVideo.xcodeproj -scheme HockeyVideo \
  -configuration Release -destination "generic/platform=macOS" \
  -onlyUsePackageVersionsFromResolvedFile CODE_SIGNING_ALLOWED=NO
```

Local builds carry only an ad-hoc signature, which is enough to run them on the Mac that built
them. To sign them with your own team, copy `Local.xcconfig.example` to `Local.xcconfig` (it is
gitignored) and fill it in. The team id, certificates and keys never go into this folder.

To open a game without the folder picker, hand the folder to the app:

```bash
open -a HockeyVideo "/Volumes/<ssd>/<game folder>"
```

## What the app does with a game folder

- **Chapters:** the shared part rules (`selectGameParts`) pick and order the game's files: GoPro
  chapters by recording, then chapter, or exported halves or quarters. A camera card works too:
  when the picked folder holds no parts, it looks in the card's `DCIM` folders.
- **Durations:** each chapter's length is the largest stream end over its tracks, rounded to
  microseconds like ffprobe's `format.duration`, the value `game_sources.duration_s` stores.
- **One timeline:** one composition places chapter `i` at the sum of the durations before it, so
  a game time is the same frame here and on the web. A track shorter than its chapter leaves a gap
  of a few milliseconds rather than shifting every later frame.
- **Frame steps:** a step moves exactly one frame of the chapter's own video track (1/50 s on 50
  fps footage) and lands in the middle of that frame, crossing a chapter seam frame by frame.

## Card import

- **Noticing a card:** a disk that mounts while the app runs, or is already in at launch, is a
  camera card when its `DCIM` camera folders hold GoPro chapters; the app then opens the import
  sheet. "Von Karte importieren …" (`⌘I`) looks again.
- **Recordings, not chapters:** the chapters are grouped by their file number (the recording id
  of the break rule) and each group is ordered and checked by the part rules
  (`cardRecordings` in `HockeyCore`). The sheet shows each recording with a thumbnail, its start
  (the first chapter's file date, in the camera clock's time), its length (the chapters'
  durations, read as for a game folder), size and chapter count. A recording with a missing
  chapter is listed but cannot be picked. The newest recording is picked to start with.
- **The library** is a folder the coach picks once, typically on the SSD; a bookmark in the
  app's preferences finds it again and never leaves the Mac.
- **Copying:** the chosen recordings go into a new game folder named after the first
  recording's start (`2026-09-27 14.05`, then ` 2` if taken), a valid chapter path segment for
  the server. Each chapter is copied under a hidden name past the page cache, flushed to the
  disk, read back and compared by size and SHA-256 with what was read from the card; only then
  does it get its name. A failed or cancelled import removes the folder, and a library without
  room is refused before anything is written.
- **Then** the game opens from the library folder under review, dated from the first recording's
  start, and its registration waits in the outbox until the Mac is online. A game this Mac
  already knew from the card keeps its tags and moves to the library folder, unless the server
  already has it (its paths are fixed then). "Karte auswerfen" ejects the card from the sheet.
- **Tests** build a synthetic card (generated chapters under GoPro names next to `.THM` and
  `.LRV` companions) in a temporary folder.

## Tagging and the local store

- **The store** is one SQLite file, `Library.sqlite` in the app's Application Support folder,
  with explicit GRDB migrations and the server's column names. Every write goes through
  `LocalStore`, one transaction each, so syncing can later add its outbox in the same
  transaction. Tags get their UUID on the Mac, the id the server will keep.
- **A game is found again by its files:** the chapter names and sizes in order. A known game
  keeps its stored durations, so its tags stay on the same frames even if a later probe differs.
- **Inputs, not constants:** each tag type's clip window (default from `tag-types.json`) and the
  game's format are passed into the rules. A game stores its own period count and length as the
  server does (`NULL` for the team default) and resolves them like `game-format.json`; the team
  default is 4 x 15 minutes until the team's settings reach the Mac. A two-halves game reads
  "Halbzeit" wherever a four-quarter game reads "Viertel".
- **One moment, several types** ([ADR 0016](../docs/decisions/0016-a-tag-carries-a-main-type-and-further-types.md)):
  a key captures a tag of its type, the main type. "Bearbeiten" in the tag detail shows every
  type as a chip to switch on or off, so a short corner that ended in a goal is one tag and one
  clip. The main type stays while it is on, else the first type on takes its place; the further
  types are stored in the order of `tag-types.json` and the rail shows every type.
- **Keys:** `T`, `E`, `G` and `S` tag, `,` and `.` jump between tags, next to the transport keys.

## Sign-in and sync

- **Sign-in** takes the server address (typed by the coach, never in the repo), the web login and
  a device name, and keeps only the device token, in the login Keychain under the item "Hockey
  Video". The password is never stored and no token is logged. `https` is required; plain `http`
  is accepted for a test server on this Mac (`localhost`). Every request names the build in
  `X-HVA-App-Version`; a `426` stops syncing and the badge reads "Bitte App aktualisieren". A
  `401` (the Mac was removed under Einstellungen > Geräte) forgets the token.
- **The outbox:** every write adds its change to the `outbox` table in the same transaction:
  register the game, its fields, create, edit or delete a tag, its players and visibility, and
  the quarter set. One entry per kind and row carries every later edit, since a change is sent
  with the row as it is then. Games from this Mac start under review, like a Drive import; a
  title and date in the "Spiel" sheet accept them.
- **Push** sends the outbox in order. Creates carry the Mac's ids, so a retry is harmless;
  updates and deletes send `If-Match` with the version the Mac last saw. A tag edit names its
  further types only when the Mac changed them, so the server keeps any the Mac has not seen. A
  change waiting on the
  coach holds back the later changes of its row, and a game's registration those of its game.
- **Conflicts:** a `409` answers with the server's row. The Mac merges it field by field against
  the base it started from (tag: its types as one, window, players; game: title, opponent, date; the quarter
  set as a whole): a field only one side changed takes that side, and a field both changed
  differently waits for the coach, "Meine Version" or "Version vom Server" behind the badge.
- **Pull** runs after each push: the library call, the roster when its revision moved, the
  team's tag windows (kept for offline capture), and the snapshot of each synced game whose
  revision moved. Rows with unsent changes keep the Mac's side. A game that is gone on the server
  stays on this Mac and stops syncing.
- **When:** at launch, when the app comes to the front, every 45 seconds while signed in, and a
  second after each change. The badge counts the changes the server does not have yet.
- **Tests** decode every golden answer in [`contracts/api/`](../contracts/api/) and run the sync
  against a server in memory that answers like the routes (`FakeServer.swift`).

## Cutting clips

- **The queue** is the server's: a Mac game's clips the browser asked for ("Clips schneiden") are
  `pending` until a cutter has a file for them, and the Mac is that cutter (ADR 0013). Each pull
  brings every tag's newest clip into the store's `clip` table. A clip waits while its tag has
  changes the server does not have yet, so the file always holds the window the server knows.
- **Cutting** follows the shared cut plan (`planClipCut`, pinned by `cut-plan.json`) and copies
  samples with `AVAssetReader` and `AVAssetWriter`, never decoding a frame. It starts on the
  keyframe at or before the tag start, found in the sample tables, and joins one piece per
  chapter. Every sample keeps its place on the game timeline, across a seam too: file time `t`
  is game time `cut_start_s + t`. The first sample in decode order lands on file time 0, so a
  reordered stream's keyframe shows a frame or two later, and the sound starts at 0 as well. The
  clip ends on the last frame that shows before the tag's end: a later frame goes in only when
  an earlier one is decoded from it, and then so do the frames before it.
- **No edit lists:** AVAssetWriter writes one per track; the cutter removes them afterwards
  (`MovieBoxes.swift`), with each track's and the movie's duration set to when its last sample
  stops showing, so browsers and AVFoundation play the same frames. The movie header goes before
  the media, so a clip plays while it loads. A passthrough reader stamps samples in media time,
  before a source file's own edit list; the cutter applies each track's shift itself.
- **Where the originals are:** opening a game keeps a bookmark to its chapter folder, so its
  clips are cut while another game plays. A clip whose disk is not connected waits ("Clips warten
  auf die Originale").
- **Uploading** uses the S5 protocol, one clip at a time: announce the upload, send 8 MiB chunks
  at the offset the server holds, resume after a break from its `HEAD`, then hand the file off
  with the tag version it was cut from and its `cut_start_s`. The cut file waits in
  `Clips/` next to the store and is removed once the server has it.
- **A moved tag:** a hand-off the server refuses because the tag moved (`409` with the tag) goes
  again with the new version when only the players changed; otherwise the file and upload are
  thrown away, and the clip is cut again once the new window has reached the Mac. A trim on the
  Mac or in the browser puts a clip back to `pending` on the server, which cuts it again the same
  way.
- **When:** after every sync, and every minute while clips wait. "Auf Akku pausieren" behind the
  clip badge holds the work while the Mac runs on battery.
- **Tests** cut synthetic chapters (with B-frames, and across a seam) and check the frames, the
  start and the boxes, and run the queue against the in-memory server with a fake cutter: chunks,
  a broken upload, a trim racing the hand-off, a trim on the Mac, battery and a missing disk.

## Updates

The app checks this repository's `mac-appcast` release for updates once a day and installs
updates signed with the Sparkle key; "Nach Updates suchen …" in the app menu checks at once. A
build whose `SUPublicEDKey` is still the placeholder in `HockeyVideo.xcconfig` leaves the updater
off and that menu item disabled.

## CI and releases

[`.github/workflows/mac.yml`](../.github/workflows/mac.yml) runs the tests and an unsigned build
on a macOS 26 runner whenever `mac/`, `contracts/` or the workflow change. A `mac-v*` tag runs
[`.github/workflows/mac-release.yml`](../.github/workflows/mac-release.yml), which signs,
notarizes and publishes the build; [`docs/ops/mac-release.md`](../docs/ops/mac-release.md) covers
the one-time setup and how to cut a release.
