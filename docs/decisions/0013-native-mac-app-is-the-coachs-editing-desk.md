# 0013 - A native Mac app is the coach's editing desk; the server stays the source of truth

- **Status:** Proposed
- **Date:** 2026-09-26
- **Deciders:** Yannik
- **Supersedes:** none
- **Superseded by:** none

Amends [ADR 0003](0003-hardware-role-split.md), [0004](0004-copy-cut-clips-with-keyframe-tolerance.md),
[0007](0007-clip-worker-lives-in-the-app-repo.md) and
[0008](0008-google-drive-holds-originals.md) for games that are registered and cut on the Mac, and
[0002](0002-global-game-time-offset-model.md) for who else implements the game-time mapping.
Builds on [ADR 0006](0006-proxy-rendition-for-in-browser-tagging.md) (the browser copy),
[0010](0010-tactics-scenes-as-versioned-json-in-pitch-metres.md) and
[0012](0012-animate-tactics-scenes-as-keyframe-steps.md) (tactics scenes) and
[0011](0011-clip-edits-are-data-rendered-at-playback.md) (clip edits), whose formats the Mac app
reuses unchanged.

## Context

Today every game reaches the app through Google Drive (ADR 0008): the coach uploads 30-60 GB of
GoPro chapters, the VPS encodes a 720p proxy, and only then can the game be tagged in the
browser and its clips cut. Uploading a game takes hours on a home line, so a game recorded on
Saturday is often not taggable before Sunday. Meanwhile the coach's M4 Mac (ADR 0003) has the
original files on a fast local SSD and a hardware video engine that plays 4K HEVC far faster than
real time.

The coach wants a native Mac app for all editing: bring a game in straight from the camera card,
watch and tag it at full quality without any network traffic, and cut its clips locally, while
the players keep watching through the login-free links they have today. The facts that shape it:

- **The web app is the product today.** Its coach pages, the share links (team, player,
  collection) and the workers all read and write one Postgres database. Players only have the
  web.
- **Game time must be identical everywhere** (ADR 0002). `game_sources.duration_s` is ffprobe's
  container duration of the original. A lab with synthetic 4K HEVC chapters showed that
  AVFoundation reports chapter lengths up to about 10 ms shorter than ffprobe (the audio track
  runs longer than the video). Over a game of several chapters that would drift by frames against
  the web app if the Mac measured its own durations.
- **A shared clip is one kind of file.** Clips are copy-cuts of the originals (ADR 0004), never
  re-encoded, starting on the keyframe at or before the tag start; `clips.cut_start_s` records
  that start (ADR 0011). The same lab showed that AVFoundation's passthrough export is instant but
  gets frame-exact starts by writing MP4 edit lists, including an empty edit across a chapter
  seam that ffmpeg warns about. Players outside Apple's handle edit lists unevenly.
- **Most coach writes are Server Actions**, which a native client cannot call. Only a few route
  handlers exist (tags, quarters, clips, comments, collections and clip edits, games list, a
  tactics scene read, suggestions), and the coach's ones accept only the browser session cookie. Rows carry
  `updated_at` but no version, so every write is last-write-wins except clip edits
  (`edit_version`, ADR 0011).
- **The clip editor (ADR 0011) and the tactics board (ADR 0010, 0012) have landed on the web**
  with versioned JSON documents (`ClipEditV1`, scene version 2), each owned by one parser
  (`parseClipEdit`, `parseScene`).
- **`hockey-video-pipeline` is retired.** The sibling project that ADR 0002, 0006 and 0007 name
  was folded into this one; nothing on the Mac app's path depends on it.

The coach settled the open questions on 2026-09-25. They are listed in the
[Mac app plan](../project/mac-app-plan.md#decisions) and cited below as D1-D10.

## Decision

**We build a native SwiftUI Mac app as the coach's editing desk. The server stays the source of
truth for everything shared; the Mac is the source of truth only for where the files lie on that
Mac.**

### Roles and scope

- **Feature parity (D2).** Every coach feature exists in both apps: the web coach pages keep
  working and get new features too, and the Mac app covers the same features on local media. What
  players see stays web-only by nature: the share links, their playback of edits and scenes,
  anonymous view counting (ADR 0009), and every `noindex` and token rule that guards them.
- **Card first (D1).** The first daily use is a game brought in from the camera card, tagged on
  the Mac and cut on the Mac, with no Drive upload before anything can happen. Games that arrive
  through Drive keep working as today and can also be opened on the Mac from a local copy.
- **The queued web work continues (D3).** The Mac app adopts the web's formats as they are.

### Code, platform and distribution

- **In this repo under `mac/` (D6):** a Swift package that holds all logic (game time, rules,
  local store, sync, media) and is fully unit-tested, plus a thin SwiftUI app target of views.
  One PR can change a server API, its contract files and the Swift client together, the same
  reason ADR 0007 brought the clip worker here.
- **macOS 26 Tahoe and newer (D8).** It is the coach's Mac and carries the newest video
  composition APIs.
- **Signed, notarized and auto-updating from the start (D7):** Developer ID signing, hardened
  runtime, notarization, and signed updates through Sparkle. The Apple team id, signing
  identities, the update key and the server URL stay out of the repo (a gitignored local config
  and CI secrets); the server URL is entered at sign-in.
- **Local store:** SQLite through GRDB, with explicit migrations. It mirrors the server's
  aggregates and adds local-only tables for file locations, the outbox of pending changes, the
  last-seen revisions and open conflicts. Share tokens are never stored on the Mac.

### Shared rules: TypeScript is the reference, Swift is a port

- **The rules the Mac needs are ported to Swift**, not run from the TypeScript: time mapping and
  source segments, recording breaks, part rules, tag capture and trims, quarters, the cut plan,
  collection notes, telestration geometry, the tactics scene, and the clip edit evaluator.
- **`contracts/` pins them.** Golden vectors and shared data files are generated from the
  TypeScript (`pnpm contracts:generate`); CI fails when a committed file no longer matches
  (`pnpm contracts:check`), and the Swift tests read the same files. A rule change therefore
  touches both languages in one PR. `tag-types.json` and `pitch.json` are the shared data. The
  tag types' clip windows and the 15-minute quarter are defaults, not constants: they may become
  team or game settings, so the rules take them as inputs in both languages. Versioned documents
  (`ClipEditV1`, the tactics scene) get JSON Schemas with accept and reject vectors, and a new
  document version ships its upgrade vectors in the same PR. A Mac build that meets a document
  version it does not know refuses to overwrite it and asks for an update.
- Alternatives rejected: running the TypeScript inside the app through JavaScriptCore (a bundle
  build and a language bridge in the playback loop, for rules that are small, pure and stable) and
  an OpenAPI spec with generated Swift (a hand-written spec next to hand-written validators; golden
  payloads give the same drift protection). Revisit OpenAPI if the app API grows past about 30
  endpoints.

### Local media and game time

- **A library folder on the Mac** (typically the external SSD) holds one folder per game with its
  chapter files, named like the game folders on Drive. `game_sources.file_path` (relative
  `<folder>/<file>`) therefore means the same file on the Mac, on Drive and on the server. The Mac
  finds files by that relative path plus size, so an SSD mounted under another name still works;
  bookmarks and absolute paths never leave the Mac.
- **Import from a card or a folder:** recordings are grouped and ordered by the shared part rules,
  copied into the library and verified by size and checksum. The game starts in the review state,
  like a Drive import, and is registered on the server once the Mac is online.
- **One game-time timeline.** The player is one composition over all chapters in which chapter
  `i` starts at the sum of the stored `duration_s` of the chapters before it, never at
  AVFoundation's own lengths. A short track leaves a gap of a few milliseconds instead of shifting
  every later frame, so a tag at game time `t` is the same frame in both apps.
- **Durations of Mac-imported chapters** are the largest stream end over the file's tracks, which
  matched ffprobe's `format.duration` in the lab. It must be confirmed on real GoPro files (they
  carry timecode and metadata tracks); when the originals reach Drive, the ingest worker re-probes
  them and logs any difference.
- **Playback uses the full-resolution originals.** There is no local proxy.

### Sync

| Data                                       | Written by                         | Direction                                                      | On conflict                                                  |
| ------------------------------------------ | ---------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| Game (title, opponent, date, review state) | both                               | both ways                                                      | row version; ask                                             |
| Chapters (order, file, size, `duration_s`) | whoever imported the game          | Mac to server for Mac games, server to Mac for Drive games     | immutable once created (ADR 0002)                            |
| Local file locations                       | Mac                                | never leave the Mac                                            | -                                                            |
| Tags (type, window, visibility, players)   | both                               | both ways                                                      | row version; merge by field, ask when the same field changed |
| Quarters                                   | both                               | both ways, one set per game                                    | set version; ask                                             |
| Roster (names, numbers)                    | both                               | both ways                                                      | row version; ask                                             |
| Clips (status, `cut_start_s`, file)        | server records; Mac cuts Mac games | status server to Mac, files Mac to server                      | upload refused if the tag changed since the cut              |
| Collections, notes, members                | both                               | both ways                                                      | row version; ask                                             |
| Clip edits (`ClipEditV1`)                  | both                               | both ways                                                      | `edit_version` (ADR 0011)                                    |
| Tactics scenes                             | both                               | both ways                                                      | row version; keep both as a copy                             |
| Comments                                   | players, coaches                   | server to Mac; the coach's replies and pins go through the API | -                                                            |
| View figures                               | server                             | server to Mac, read only                                       | -                                                            |
| Share tokens                               | server                             | fetched on demand to copy a link, never stored on the Mac      | -                                                            |

- **Pull is revision plus snapshot.** A library call lists every game, collection and scene with
  a `revision` that a database trigger bumps on any change to the aggregate's rows, so web edits,
  Mac edits and worker updates all count. The Mac fetches a full snapshot of each aggregate whose
  revision moved. A deleted aggregate drops out of the list, so no tombstones or change log are
  needed at this data size.
- **Push is an ordered outbox.** Every Mac edit is written to the local store and the outbox in
  one transaction, so the UI never waits for the network. Creates carry client-made UUIDs and are
  idempotent; updates and deletes carry the row's base `version`. A stale write gets `409` with the
  current row: the Mac merges changes to different fields itself and asks the coach ("Meine
  Version" or "Version vom Server") when the same field changed. Nothing is ever overwritten
  silently, the same rule as `edit_version`.
- **Offline:** everything on games with local media works offline (tagging, cutting, collections,
  edits, scenes, presentation); pending changes are always visible. Copying a share link, token
  rotation, comments and view figures need the server.

### Uploads

In priority order, one at a time, resumable, pausable on battery:

1. **Changes** (tags, notes, edits, scenes): at once, a few KB.
2. **Game registration** of a Mac game: chapter names, sizes and `duration_s`, and the folder
   name.
3. **Finished clips** of Mac games, about 50-225 MB each: full resolution, never re-encoded, right
   after cutting, because every team clip shows on the team link.
4. **The 720p browser copy (D5):** every Mac game gets one, so it can always be tagged in the
   browser too. The Mac encodes it with its hardware encoder, preserving duration and timebase,
   and uploads it to the same relative path under the proxy root (the ADR 0006 contract). The
   server checks its duration before the watch page serves it; until then the web lists the game
   as waiting for its browser copy.
5. **The originals backup (D4):** after the game is accepted, the Mac copies the game folder into
   the Google Drive for desktop folder, which uploads in the background and holds the Google
   login. The ingest worker recognises the folder as the already registered game (from the folder
   row written at registration) and links it instead of importing it again.

### Clips: one cutter per game

- **`games.media_home`** says where a game's originals are cut from: `drive` for games imported
  through Drive, `mac` for games registered by the Mac. The VPS claim query skips `mac` games, so
  each game has exactly one cutter and the single-worker queue of ADR 0007 keeps its guarantee.
- **The Mac treats its games' `pending` clips as its queue.** It cuts from the local originals,
  then uploads the file stating the tag version it cut from. The server accepts only if the tag is
  still at that version, so a cut made before a later trim is refused and redone.
- **A Mac cut follows the server's contract** (ADR 0004): it starts on the keyframe at or before
  the tag start, joins one piece per chapter along the shared cut plan, records `cut_start_s`, and
  copies samples without re-encoding. It writes no MP4 edit lists, so a Mac clip plays like a
  server clip in every browser.
- **Uploads land in a staging directory outside the served media.** The clip worker, which owns
  `clips/` and has ffprobe, checks the streams and the duration, moves the file into place and
  marks the clip `ready`. The web process never writes into served media.
- **When the originals backup has been linked on Drive**, the game's `media_home` becomes `drive`
  and the VPS cuts its clips from then on, so a trim made in the browser is re-cut while the Mac
  is off.
- **A baked export** (slow motion, zoom and markers built into an MP4) is made on the Mac for
  sharing outside the app. It stays a local file and is never uploaded as the shared clip.

### Sign-in and the app API

- **Device sessions.** The Mac signs in with the coach's email and password and a device name and
  receives a bearer token, stored hashed like web sessions (ADR 0005) and kept in the Keychain. It
  lasts until the coach removes the device under "Einstellungen > Geräte" or it goes 180 days
  unused; a password change revokes it like every other session. Bearer tokens are accepted on
  `/api/*` only; pages and Server Actions stay cookie-only, so no CSRF surface is added.
- **A versioned app API.** New route handlers live under `/api/app/v1/`, calling the same queries
  and parse functions as the Server Actions, so no rule exists twice on the server. Existing
  route handlers gain bearer auth, optional client ids and `If-Match` without breaking the web.
  Every request carries its app version; the server answers `426` to a build older than it
  supports.

### The auto-camera render job (D10)

The render job of the auto-camera roadmap (Phase C) lives in this repo: inside the Mac app, which
wraps `reco-cli` with a queue, resume after sleep and progress, or in its own folder here if that
proves cleaner. Its output enters the app as a Mac game.

## Consequences

- A game is taggable minutes after the card is in, and its clips are on the links minutes after
  tagging, without uploading the originals first. The coach's upload shrinks to a few GB of clips
  and a browser copy; the originals follow in the background.
- Building every feature in both apps roughly doubles the cost of each coach feature, and the
  coach checks media features by hand on real footage, which cannot go into the public repo or
  CI. This is the largest cost of this decision.
- Every shared rule and document format has two implementations. `contracts/` makes a forgotten
  side fail in CI instead of in a game, but only for the rules it pins: porting a rule means adding
  its vectors first.
- The schema grows: row `version` columns and aggregate `revision` triggers, device sessions,
  `games.media_home`, and upload staging. Every web write path must bump versions, which is why
  triggers do it rather than each query.
- Personal data of mostly minor players now also sits on the coach's laptop; FileVault protects
  it, and a GDPR erasure on the web removes the player from the Mac at the next roster pull.
- Apple ships new tools every year; keeping the build current costs a few days a year.
- The VPS is no longer the only cutter (ADR 0003, 0007), and originals of a Mac game live only on
  the Mac until the backup lands (ADR 0008). A lost SSD before the backup loses that game's
  originals, but not its tags or uploaded clips.
- Revisit this if the Mac app and the web coach pages drift apart despite the contracts, if sync
  conflicts turn out to be frequent in practice, or if the browser copy's upload proves too heavy
  for the coach's line.
