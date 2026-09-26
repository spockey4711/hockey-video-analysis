# Plan: the native Mac app

- **Created:** 2026-09-26
- **Decision record:** [ADR 0013](../decisions/0013-native-mac-app-is-the-coachs-editing-desk.md)
- **Shared rules:** [`contracts/`](../../contracts/README.md)

The coach's editing desk as a native SwiftUI Mac app: bring a game in from the camera card, watch
and tag it at full quality from the local SSD without network traffic, cut its clips on the Mac,
and do every other coach job there too, while the server stays the source of truth and the players
keep their links. This file is the slice plan the work follows: each slice is one PR into
`develop`, in dependency order, small and self-contained enough to brief on its own.

## Decisions

The coach settled these on 2026-09-25. ADR 0013 records the architecture; this plan follows them.

|     | Question                                        | Answer                                                                                                    |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| D1  | Where to start                                  | Games straight from the card, with clips cut on the Mac                                                   |
| D2  | The web coach pages                             | Every coach feature is built in both apps                                                                 |
| D3  | Clip editor and tactics work queued for the web | Continues as planned; the Mac reuses its formats                                                          |
| D4  | Originals of Mac-made games                     | Backed up to Google Drive in the background                                                               |
| D5  | Tagging Mac-made games in the browser           | Always, through a 720p browser copy made on the Mac                                                       |
| D6  | Where the Mac code lives                        | This repo, under `mac/`                                                                                   |
| D7  | Signing and updates                             | Signed, notarized, auto-updating builds from the start (a developer account exists)                       |
| D8  | Which macOS                                     | macOS 26 Tahoe and newer                                                                                  |
| D9  | Pace                                            | Mac slices run as a third lane next to the two web lanes                                                  |
| D10 | The auto-camera render job                      | Inside the Mac app, or its own folder in this repo if that is cleaner; `hockey-video-pipeline` is retired |

## Rules for every slice

- **One slice, one PR into `develop`,** up to about 2,000 changed lines with tests and docs.
  Generated files do not count: the drizzle snapshot of a migration and the JSON under
  `contracts/`.
- **Lane markers.**
  - **server** slices change the web app, its workers or the database. A **migration** slice must
    be sequenced with every other migration in flight (one at a time across all lanes).
  - **mac** slices change only `mac/`, the `.github/workflows/mac*.yml` workflows, `contracts/`
    (to add the vectors of the rules they port) and docs. They cannot conflict with the web lanes,
    so they run as the third lane (D9).
- **Port against vectors.** A Mac slice that ports a rule first adds the rule's golden vectors
  (a builder in `contracts/generator/`, then `pnpm contracts:generate`) and makes the Swift port
  pass them. A slice that changes a pinned TypeScript rule regenerates the vectors and, once
  `mac/` exists, updates the Swift port in the same PR. See
  [`contracts/README.md`](../../contracts/README.md).
- **Reuse the web's formats unchanged:** `tag-types.json`, `ClipEditV1` (ADR 0011), the tactics
  scene (ADR 0010, 0012), game time (ADR 0002), the cut contract (ADR 0004). The server's parse
  functions stay the only authority on what is valid.
- **Public repo.** No footage as test fixtures (tests generate short synthetic chapters, as the
  contracts do), no Apple team id, signing identity, update key, server URL, bookmark or local
  path in committed files. Signing values live in a gitignored `mac/Local.xcconfig` (with a
  committed `Local.xcconfig.example`) and in CI secrets.
- **German UI copy lives in a content layer** on both sides: `content.ts` modules on the web, a
  String Catalog in the Mac app. Labels shared with the web (tag types) come from `contracts/`.
- **Quality gates.** Server slices pass the usual gate from `CONTRIBUTING.md` (CI adds
  `pnpm contracts:check`). Mac slices pass `swift test` for the package and an `xcodebuild` build
  with warnings as errors; CI runs both on a macOS runner. No format check.
- **The coach checks media slices by hand.** Agents can build and unit-test the app but cannot
  judge playback on real footage. Every slice that touches playback, cutting, import or upload
  ends its PR with a short "Check on your Mac" list; the footage stays on the coach's machine.
- **Docs change in the same PR:** the coach guide for what the coach can now do, `docs/ops/` for
  anything the VPS runs, `contracts/README.md` for new contract files.

## Order

| #   | Slice                                             | Lane              | Depends on       | The coach can afterwards                                       |
| --- | ------------------------------------------------- | ----------------- | ---------------- | -------------------------------------------------------------- |
| 1   | S1 Contracts and ADR 0013                         | server            | -                | nothing new (this PR)                                          |
| 2   | M1 Player                                         | mac               | S1               | watch any game folder from the SSD or the card at full quality |
| 3   | M2 Signed, auto-updating builds                   | mac               | M1               | install a signed app that updates itself                       |
| 4   | M3 Local tagging                                  | mac               | M1               | tag a whole game on the Mac, offline                           |
| 5   | S2 Device sign-in                                 | server, migration | S1               | see and remove the Mac under Einstellungen > Geräte            |
| 6   | S3 Sync API                                       | server, migration | S2               | nothing new                                                    |
| 7   | S4 Register Mac games                             | server, migration | S3               | nothing new                                                    |
| 8   | M4 Sign in, register and sync                     | mac               | M3, S4           | see Mac-tagged games, tags and players on the web              |
| 9   | M5 Card import                                    | mac               | M4               | put in the card, pick the recording, tag at once               |
| 10  | S5 Clip upload                                    | server, migration | S4               | nothing new                                                    |
| 11  | M6 Cut clips on the Mac                           | mac               | M5, S5           | **first daily use:** clips on the links minutes after tagging  |
| 12  | S6 Browser copy of Mac games                      | server            | S5               | tag Mac games in the browser (once M7 uploads the copy)        |
| 13  | M7 Make the browser copy                          | mac               | M6, S6           | every Mac game is taggable in the browser too                  |
| 14  | S7 Link the Drive backup                          | server            | S4               | nothing new                                                    |
| 15  | M8 Back up the originals                          | mac               | M6, S7           | originals reach Drive with no extra step                       |
| 16  | M9 Drive games on the Mac                         | mac               | M4               | tag games that came in through Drive from a local copy         |
| 17  | S8 Collections API                                | server            | S3               | nothing new                                                    |
| 18  | M10 Collections                                   | mac               | M4, S8           | build and share collections with notes on the Mac              |
| 19  | M11 Telestration                                  | mac               | M3               | draw on a paused frame, same look as the web                   |
| 20  | M12 Presentation                                  | mac               | M10, M11         | present at the club with notes on the laptop, offline          |
| 21  | M13 Clip editor: trim and slow motion             | mac               | M10              | trim and slow down collection clips on the Mac                 |
| 22  | M14 Clip editor: zoom and markers                 | mac               | M13, M11         | the full clip editor on the Mac                                |
| 23  | M15 Baked export                                  | mac               | M14              | save an edited clip as a normal video file                     |
| 24  | S9 Scenes API                                     | server            | S3               | nothing new                                                    |
| 25  | M16 Tactics board                                 | mac               | S9, M11          | the tactics board on the Mac                                   |
| 26  | M17 Tactics animation and scenes in presentations | mac               | M16, M12         | animate scenes and present them                                |
| 27  | S10 Roster and settings API                       | server            | S3               | nothing new                                                    |
| 28  | M18 Roster and settings                           | mac               | S10, M4          | manage players and the account on the Mac                      |
| 29  | S11 Comments, insights and reports API            | server            | S3               | nothing new                                                    |
| 30  | M19 Comments, insights and reports                | mac               | S11, M10         | read comments, view figures and reports on the Mac             |
| -   | M20 Auto-camera render node                       | mac               | M5, roadmap gate | render follow-cam games on the Mac (later)                     |

- **Critical path to first daily use:** S1, M1, M3, S2, S3, S4, M4, M5, S5, M6. M2 lands early so
  the coach runs every later slice as a signed update.
- **Two lanes can move at once:** the mac lane (M1, M2, M3) runs while the server lane builds S2,
  S3 and S4. From M4 on, each Mac slice waits for the server slice it names.
- **Migrations:** S2, S3, S4 and S5 each add one; queue them with any web migration in flight.
  S3 adds the `version` and `revision` columns for every aggregate at once, so S8, S9 and S10 need
  no migration of their own.
- **Web counterparts (D2).** Most parity work is Mac catching up with the web. The web side
  gains the Geräte page (S2), the "waiting for its browser copy" and "cut on the Mac" states (S4,
  S6), and the optional in-browser MP4 export already in the backlog as the counterpart of M15.
  Card import, local cutting and offline work are Mac-only by nature; share links and view counting
  are web-only by nature.

## Phase 0 - Foundations

### S1 - Contracts and ADR 0013 (server, no migration; this slice)

- ADR 0013 with the architecture and D1-D10, amending ADR 0002, 0003, 0004, 0007 and 0008.
- `contracts/` generated from the TypeScript: `tag-types.json`, `pitch.json`, and vectors for the
  time mapping, source segments, recording breaks, tag capture, part rules, quarters, and the
  clip end and cut plan. `pnpm contracts:generate` and `pnpm contracts:check`, the latter in CI and
  in `pnpm test`.
- This plan.

### M1 - Player (mac, about 1.9k)

- **Project:** `mac/HockeyKit/` (Swift package: `HockeyCore` for pure rules, `HockeyMedia` for
  AVFoundation; Swift Testing) and `mac/HockeyVideo/` (app target) with
  `HockeyVideo.xcodeproj` using buildable folders, so new files do not touch the project file.
  Swift 6 language mode, deployment target macOS 26, warnings as errors.
- **CI:** `.github/workflows/mac.yml` on the `macos-26` runner, path-filtered to `mac/**` and
  `contracts/**`: `swift test` for `HockeyKit`, then `xcodebuild build` with
  `CODE_SIGNING_ALLOWED=NO`.
- **Ports passing the S1 vectors:** time mapping, source segments, part rules and recording
  breaks. The Swift tests read `contracts/vectors/*.json` directly (a test helper decodes the
  vector format and compares within the file's tolerance). The player also ports the playback
  rates (`player/playback-rate.ts`) and the clock format (`player/format-timecode.ts`), so M1
  pins those two first.
- **"Ordner öffnen"** on a card or SSD folder: the part rules order the chapters, each chapter's
  duration is the largest stream end over its tracks (ADR 0013), and one composition places
  chapter `i` at the sum of the durations before it.
- **Player window:** play and pause, the web's transport keys from
  `src/features/player/useTransportHotkeys.ts` (skips, rates 0.25-4, B/N frame steps), a scrub
  bar that marks recording breaks but not chapter seams (like the web's), the game clock,
  fullscreen, and the system's light or dark appearance. A frame step moves one frame of the
  chapter's own video track.
- **Check on your Mac:** open a real game from the card and from the SSD; compare each chapter's
  duration with ffprobe's `format.duration` (the rule must match on real GoPro files, which carry
  timecode and metadata tracks); scrub, step and play across a seam; note seek times.
- **Also:** `mac/README.md` (build, run, test), and the repo's `CLAUDE.md` and `README.md`
  corrected to say the Mac app lives in `mac/`.
- **Coach after:** watch any game folder at full quality as one continuous game, with slow motion
  and frame steps. No login, no upload.

### M2 - Signed, auto-updating builds (mac, about 0.8k plus setup)

- Developer ID signing with the hardened runtime, notarization with `notarytool` and stapling,
  in a release workflow that runs on a `mac-v*` tag (separate from the web app's releases).
- Sparkle 2 for updates: EdDSA-signed update archives and an appcast attached to a GitHub
  release of this repo, the public key in `Info.plist`, "Nach Updates suchen" in the app menu,
  automatic checks.
- `mac/Local.xcconfig.example` documents the local values (`DEVELOPMENT_TEAM` and the like); the
  real file is gitignored. `docs/ops/mac-release.md` lists the CI secrets (certificate, notary
  key, Sparkle key) and how to cut a release.
- **Needs the coach:** create the Developer ID certificate and notary API key, generate the
  Sparkle key pair, and add the secrets to the repository. The slice can merge before that; the
  first release waits for it.
- **Check on your Mac:** install the first signed build, open it without a Gatekeeper warning,
  and receive a second build as an update.
- **Coach after:** a signed app that keeps itself up to date.

### M3 - Local tagging (mac, about 2k)

- GRDB store with migrations: local games (folder, chapters, durations), tags, quarters. Every
  write goes through one store module so M4 can add the outbox in the same transaction.
- **New vectors first:** tag trims and window nudges (`src/features/tagging/edit/trim.ts`),
  re-cut detection (`tagging/edit/recut.ts`), tag validation (`tagging/validation.ts`) and jump
  markers (`src/features/player/jump-markers/navigation.ts`). Quarters and tag capture are
  already pinned, and M1 pinned the playback rates and the clock format.
- Hotkeys t/e/g/s with the windows passed into the capture rule as an input like the period
  length: the defaults from `tag-types.json` here, and from S3 on the team's windows from
  `GET /api/tag-windows` (the shape is in [`contracts/README.md`](../../contracts/README.md#tag-windows)),
  with the last synced answer used offline. The game format is a team setting too (a team
  default in `team_settings`, optionally per game): the Mac
  resolves a game's format like `vectors/game-format.json` and passes the period length to the
  quarter clock and the period count to the quarters editor and its validation; a tags rail
  and tag detail (type, window
  nudges, delete); jump markers `,` and `.`; the quarters editor with bands, the quarter clock and
  break skip.
- **Check on your Mac:** tag a real game with the keys while it plays, also in fullscreen; nudge a
  tag's start and end and see the picture park on that frame; jump with `,` and `.` across a
  chapter seam; mark the quarters, play into a break and see it skip to the next start with the
  match clock right; quit, rename the folder, reopen it and find the tags and quarters again.
- **Coach after:** tag a whole game on the Mac, offline. The tags stay on this Mac until M4.

## Phase 1 - Card to links (first daily use)

### S2 - Device sign-in (server, migration, about 1.3k)

- `sessions.kind` (`web` or `device`), `device_name` and `last_seen_at`. A device session lasts
  until removed, with an expiry after 180 days unused; web sessions keep their fixed 30 days (ADR
  0005). A password change revokes device sessions too.
- `POST /api/app/v1/sessions` (email, password, device name; the web login's scrypt check and
  rate limit) returns a bearer token, stored only as its hash. `DELETE /api/app/v1/sessions`
  signs out. Answers (all `no-store`): `201 {"token"}`, `204` on sign-out, `400` for a bad body
  or a missing version header, `401`, `426 {"minVersion"}` and `429` with `Retry-After`.
- Route handlers accept `Authorization: Bearer` on `/api/*` only, through `getApiSession`;
  `getCurrentCoach` stays cookie-only, so pages and Server Actions never accept the token. A
  device token set as a cookie, or a web cookie sent as a bearer token, is refused. Existing
  route handlers switch to `getApiSession` in the slice that first needs them from the Mac.
- Every `/api/app/v1/*` request carries `X-HVA-App-Version`; the server answers `426` below the
  minimum it supports (a server constant, raised when the API breaks).
- "Einstellungen > Geräte": every browser (a coarse label such as "Safari auf iPhone", never the
  full user agent) and the Mac with last use, "Dieses Gerät" on this browser, "Abmelden" per
  row and "Alle anderen abmelden". `last_seen_at` is written at most once an hour, so page
  renders stay read-mostly; a device session's 180 days count from that write.
- **Coach after:** sees the Mac under Einstellungen > Geräte and can sign it out (testable with
  `curl` until M4).

### S3 - Sync API (server, migration, about 1.8k)

- `version` columns (bumped on every update) on games, tags, players, collections,
  `collection_clips` (next to the existing `edit_version`) and `tactics_scenes`, plus a quarters
  version on games. A `revision` on games, collections and scenes (and one for the roster),
  bumped by database triggers on any change to the aggregate's rows, so no write path can miss it.
- `GET /api/app/v1/library` (every game, collection and scene with its revision, plus the roster
  revision), `GET /api/app/v1/games/{id}` (game, chapters, quarters, tags with players and
  visibility, clip status) and `GET /api/app/v1/players` (no share tokens in any payload).
- The Mac reads the team's tag windows from `GET /api/tag-windows` on each sync, keeps the last
  answer for offline capture and passes each type's window into the capture rule; the route
  exists already and gains bearer auth through S2's `getCurrentCoach`.
- `POST /api/tags` accepts a client-made id and is idempotent on retry. `PATCH` and `DELETE` on
  `/api/tags/[id]`, `PUT /api/tags/[id]/players` and `PUT /api/quarters` accept `If-Match` and
  answer `409` with the current row when it moved. The web keeps working without the header.
- Route handler tests write their example responses to `contracts/api/*.json` (the golden
  payloads the Swift client decodes); `contracts:check` does not own that folder.

### S4 - Register Mac games (server, migration, about 1.6k)

- `games.media_home` (`drive` or `mac`, default `drive`).
- `POST /api/app/v1/games` creates a game with its chapters (relative paths, sizes,
  `duration_s`) in the review state, with a client-made id, and writes the `ingest_folders` row a
  later Drive upload of the same folder will match (S7).
- `PATCH /api/app/v1/games/{id}`, `POST .../accept` and `POST .../discard` as route handlers over
  the review queries the Server Actions use.
- The clip worker's claim query skips `mac` games. The web shows their pending clips as "wird auf
  dem Mac geschnitten" rather than as stuck.

### M4 - Sign in, register and sync (mac, about 2k)

- Sign-in (server URL, email, password, device name) with the token in the Keychain; sign-out.
- Registers local games on the server; pulls the library, roster and game snapshots by revision
  (on activation, every 30-60 s online, after each push).
- The outbox: tags, tag players and visibility, quarters and game fields are pushed in order,
  idempotent, with base versions. A `409` merges different fields itself and asks "Meine Version"
  or "Version vom Server" when the same field changed.
- A sync badge ("3 Änderungen nicht synchronisiert"), and the `426` answer shown as "Bitte App
  aktualisieren". The Swift client decodes the S3 golden payloads in its tests.
- **Check on your Mac:** tag offline, reconnect, edit the same tag in the browser and on the Mac,
  and resolve the conflict.
- **Coach after:** games tagged on the Mac appear on the web with their tags and players.

### M5 - Card import (mac, about 1.9k)

- Notices a mounted card and lists its recordings, grouped by GoPro file number with a
  thumbnail, start time and length (the part rules and recording ids from M1).
- Copies the chosen recordings into a new game folder in the library, verifying size and
  checksum, with progress; the card can be ejected afterwards. The game starts in review, dated
  from the files, and is registered once online.
- **Check on your Mac:** import a real card, compare the copies, eject, tag.
- **Coach after:** put in the card, pick the recording, and tag at once.

### S5 - Clip upload (server, migration, about 1.5k)

- A small resumable upload protocol: `POST /api/app/v1/uploads` (size, purpose, target),
  `PATCH /api/app/v1/uploads/{id}` with an offset, `HEAD` for the current offset; a size cap; the
  bytes go to a staging directory outside the served media (a new env variable, declared in
  `.env.schema` and `.env.example`).
- `POST /api/app/v1/clips/{id}/file` hands a finished upload to the clip worker, stating the tag
  version the Mac cut from; the server refuses it if the tag has moved on.
- The clip worker checks each upload with ffprobe (streams, duration against the window), moves
  it into `clips/`, records `cut_start_s` and marks the clip `ready`; replaced files are removed as
  today. `docs/ops/` covers the staging directory and the proxy's request size limits.

### M6 - Cut clips on the Mac (mac, about 1.8k)

- The Mac treats its games' `pending` clips as its queue. A passthrough cutter copies samples
  with `AVAssetReader` and `AVAssetWriter`: it starts on the keyframe at or before the tag start,
  joins one piece per chapter following the cut plan vectors, writes no MP4 edit lists, and
  records `cut_start_s`.
- Background uploads through S5, one at a time, resumable, paused on battery if the coach wants.
- A tag trim on the Mac or the web re-cuts the clip.
- **Check on your Mac:** play Mac-cut clips, including one across a chapter seam, on the team link
  in Chrome, Safari and Firefox and on an iPhone; compare the first frame with the tag start.
- **Coach after (first daily use):** clips of a card game are on the team and player links
  minutes after tagging, without uploading the originals.

## Phase 2 - Browser copy and backup

### S6 - Browser copy of Mac games (server, about 1.2k)

- `PUT` of a chapter's 720p copy through the S5 upload protocol; the worker checks that its
  duration matches the chapter's `duration_s` (the ADR 0006 contract) and moves it to the same
  relative path under the proxy root.
- The web lists a Mac game as soon as it is registered and shows "Browser-Kopie wird
  hochgeladen" on its watch page until every chapter's copy is in place; then it plays and tags
  like any game. The VPS never encodes a Mac game's copy.

### M7 - Make the browser copy (mac, about 1.2k)

- After a game is accepted, the Mac encodes each chapter to 720p with the hardware encoder,
  keeping duration and timebase, and uploads it after the clips (clips always go first).
- Progress per game in the app; a failed or interrupted copy resumes.
- **Check on your Mac:** tag a Mac game in the browser and on the Mac, and compare that the same
  tag shows the same frame.
- **Coach after:** every Mac game can also be tagged in the browser (D5).

### S7 - Link the Drive backup (server, about 0.8k)

- The ingest worker recognises a Drive folder that matches a registered Mac game (the S4 folder
  row, chapter names and sizes) and links it instead of importing it again.
- It re-probes each chapter and logs any `duration_s` difference against the Mac's value (the
  stored value stays, since tags depend on it), then sets the game's `media_home` to `drive`, so
  the VPS cuts its clips from then on.
- `docs/ops/` notes the linking and what a logged difference means.

### M8 - Back up the originals (mac, about 1.0k)

- After a game is accepted, the Mac copies its folder into the coach's Google Drive for desktop
  folder (chosen once in the settings), which uploads in the background and holds the Google
  login. Verifies the copy by size, shows the backup state per game, and stops cutting a game
  once the server reports it as `drive`.
- **Coach after:** originals are backed up on Drive with no extra step, and a trim made in the
  browser is re-cut even when the Mac is off (D4).

## Phase 3 - Parity: Drive games, collections, drawing, presentation

### M9 - Drive games on the Mac (mac, about 1.4k)

- "Mit lokaler Kopie verbinden": points a Drive-imported game at its folder on the SSD (or in the
  Drive for desktop folder), matching files by relative path and size and checking durations.
- Tagging and sync work as for Mac games; "Clip schneiden" calls `POST /api/clips` and the VPS
  cuts, since the game's `media_home` is `drive`.
- **Coach after:** games that came in through Drive can be tagged on the Mac from a local copy.

### S8 - Collections API (server, about 1.4k)

- Extends the existing `/api/collections` routes with bearer auth and versions, and adds what the
  web does through Server Actions today: rename, delete, team and presenter notes, member order,
  `GET /api/app/v1/collections/{id}` as a snapshot, and a share URL fetched on demand.
- New vectors for the collection notes rules (`src/features/share/collections/validation.ts`).

### M10 - Collections (mac, about 1.9k)

- Create and rename collections; a clip picker filtered by game, tag type and player, with the
  `single` badge; team notes and presenter notes with the web's limits; copy the link.
- Members play from the local originals in game time, or stream the clip file for games without
  local media.
- **Coach after:** build and share collections with notes on the Mac.

### M11 - Telestration (mac, about 1.8k)

- New vectors for the telestration geometry and styles (`src/features/player/telestration/`
  `state.ts`, `geometry.ts`, `render.ts`). A port of the
  tools, four pens, widths, dotted style, curved arrow, arrowheads and halo, drawn with SwiftUI
  `Canvas` in picture coordinates 0..1.
- Undo, a PNG still export, and the D key on the paused player.
- **Coach after:** draw on a paused frame on the Mac, with the same look as the web.

### M12 - Presentation (mac, about 2k)

- A presenter window on the laptop (current and next clip, presenter notes, the clip list) and
  an audience window full screen on the second display, or near full screen with one display.
  The web's presenter view is the tested model: the audience window gets only the picture and
  what is drawn over it, never the notes, as in the protocol of
  [ADR 0015](../decisions/0015-present-on-a-second-screen-over-a-broadcast-channel.md).
- Team-note title cards, drawing and the light pointer; the web's presentation keys
  (`src/features/share/presentation/presentation-tools.ts`).
- Plays from local media and works without a network.
- **Coach after:** present a collection at the club with the notes only on the laptop, even
  without Wi-Fi.

## Phase 4 - Clip editor

The editor writes the web's `ClipEditV1` through the existing
`GET`/`PUT /api/collections/[id]/clips/[clipId]/edit` routes with `edit_version` (ADR 0011).

### M13 - Clip editor: trim and slow motion (mac, about 2k)

- `contracts/schemas/clip-edit-v1.schema.json` with accept and reject vectors for
  `parseClipEdit`, plus vectors for `toPlaybackPlan` and `editStateAt`; the Swift ports pass them.
- An editor window on the local originals: trim in and out points, slow-motion ranges (0.5x and
  0.25x, muted); saves with `edit_version` and handles `409`.
- **Coach after:** trim and slow down collection clips on the Mac; players see the result on the
  link.

### M14 - Clip editor: zoom and markers (mac, about 1.8k)

- Zoom keyframes as a view transform over the full-resolution picture; markers drawn with the M11
  tools, freezing the picture or running on; show and hide, also in presentation.
- **Coach after:** the full clip editor on the Mac.

### M15 - Baked export (mac, about 1.3k)

- An MP4 with the edits built in: slow motion through time scaling, zoom and markers through one
  custom video compositor (the same one the preview uses), a hardware encode, sound muted in slow
  motion.
- Saved to a file or handed to the macOS share sheet. It never replaces the shared clip.
- **Coach after:** send an edited clip as a normal video file.

## Phase 5 - Tactics

### S9 - Scenes API (server, about 1k)

- Route handlers over the tactics queries and `parseScene`: the existing
  `GET /api/tactics/scenes/[id]` gains bearer auth and the scene's version, and create, save with
  `If-Match`, duplicate and delete are added.
- `contracts/schemas/tactics-scene.schema.json` (version 2) with accept and reject vectors for
  `parseScene`, including the version 1 upgrade and the size caps, and vectors for the animation
  engine (`src/features/tactics/animation.ts`).

### M16 - Tactics board (mac, about 2k)

- The pitch drawn from `pitch.json` (checked against its markings), both teams and the ball,
  lines and arrows in the telestration pens; select, move, nudge 0.5 m or 5 m, delete, undo.
- Saves and syncs; on a conflict both versions are kept ("... (Kopie)").
- **Coach after:** the tactics board on the Mac.

### M17 - Tactics animation and scenes in presentations (mac, about 1.8k)

- Steps with moves and durations (ADR 0012) played by the ported animation engine.
- The board in presentation mode, as on the web since tactics slice 3: `t` over the paused clip
  opens the lineup, an empty pitch or a saved scene, and closing returns to the same moment.
- Prepared scenes in collections, once the web's tactics slice 3 defines how a collection holds
  them.
- **Coach after:** animate scenes and present them from the Mac.

## Phase 6 - Admin parity

### S10 - Roster and settings API (server, about 1.5k)

- Route handlers over the player queries and actions: create, rename, change the number, delete,
  GDPR erasure, token rotation (answering with the new share URL, never storing it on the Mac),
  and the password change. The team link comes from `team_settings.team_share_token` (the
  `TEAM_SHARE_TOKEN` env only seeds it): a share-URL call returns it for the Mac to copy, and a
  replace call answers with the new URL, never stored on the Mac either.

### M18 - Roster and settings (mac, about 1.6k)

- The roster with create, edit, delete and erasure (with the web's confirmations), link rotation,
  and the password change.
- **Coach after:** manage players and the account on the Mac.

### S11 - Comments, insights and reports API (server, about 1.4k)

- Read routes for clip comments per game and collection (and the coach's reply and pin, as on
  the web), collection insights, and the report figures per game and team, including the CSV.

### M19 - Comments, insights and reports (mac, about 1.8k)

- Comment threads on clips, collection view figures, and the game and team reports with CSV
  export.
- **Coach after:** everything the coach does on the web can be done on the Mac.

## Later

### M20 - Auto-camera render node (mac, about 2k; D10)

- A wrapper around `reco-cli` in the Mac app: a queue, resume after sleep, progress and errors,
  calibration per rig. The rendered game enters the app as a Mac game (M5's import path), so it
  is tagged, cut, copied for the browser and backed up like any card game.
- Only after the auto-camera go/no-go on 2026-10-25 and the roadmap's Phase C architecture sprint
  (S6), which may instead put the render job in its own folder of this repo.
