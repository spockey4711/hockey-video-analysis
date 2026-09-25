# Backlog

The prioritized task list - the source of truth for what to build next. Reference an id in
commits and PRs (e.g. `Refs: P2-1`). Task markers: `- [ ]` not started, `- [~]` in progress or
done-but-incomplete, `- [x]` fully done. Check the box before the merge PR, not after. Use `- [x]`
only when nothing is left to do; use `- [~]` whenever concrete steps still remain (a CLI command,
server/route wiring, a follow-up). Once a task is started it is never left `- [ ]` - an in-progress
task is `- [~]` (see the task lifecycle in `docs/engineering/git-workflow.md`).

Scope: this is the **web app** (coach tagging + clip sharing) plus its workers: the ffmpeg clip
cut worker (ADR 0007) and the Google Drive game import (ADR 0008). The Python double-whistle
detector lives in the sibling project `hockey-video-pipeline`; tasks here cover only the app's
side of that integration (show suggestions).

Scope note (whistle processing): double-whistle detection and any whistle-driven auto-tagging are
deliberately **out of the MVP flow** - a coach tags moments manually. The whistle-suggestion review
UI (P1-5) that was already built stays in the tree, but it is not part of the MVP path (so P2-2's
mount is deferred), and whistle processing must not be wired into the auto-ingest flow (P2-9).

## Status

The full MVP is shipped: the design system (DS-\*), core tag-and-share flow (P0-\*), the P1
round-out, and the UX composition/polish wave (UX-\*) all merged into `develop`. That completed
list is archived at [`archive/backlog-mvp.md`](archive/backlog-mvp.md) as the historical record.

The items below were captured during the MVP as out-of-scope follow-ups. Promote one to a numbered
task (with an owned path and a wave, following the pattern in the archived backlog) when the team
picks it up.

## P2 - wire the built features into one usable coach product

The W1-W6 waves each landed a working part, but several are reachable only through their API or sit
as an unmounted component - so the end-to-end coach flow (tag a moment -> cut a clip -> hand a link
to the team) is not yet clickable. These tasks compose what already exists; they add UI wiring and
one docs page, not new domain logic. Same flow per task: `wt new <type>/<slug>` off `develop`, small
commits, quality gate, PR into `develop`, `Refs: <id>`.

- [x] `[W7]` P2-1: Clip creation and cut-status in the watch page. The `POST /api/clips` route and
      `enqueueClipForTag` (P0-9) exist, but no client component calls `/api/clips` - a coach can tag
      but cannot trigger a cut or see progress. Add a coach-facing control to enqueue a clip from a
      tag and a status view (pending/processing/ready/failed via the existing `StatusBadge`), reading
      back through `GET /api/clips?gameId=`/`?tagId=`. Reuse `src/features/clips/**` and
      `src/features/clips/status.ts`; no schema or route change. **This is the top priority - without
      it the product is a tagging app, not a clip-sharing app.** Owns:
      `src/components/watch/**` (clip control + status), watch-page mount as coordination touch.
- [ ] `[W7]` P2-2: Mount the whistle-suggestion review. `SuggestionReview` (P1-5) is built and tested
      but mounted nowhere, so the double-whistle goal-suggestion flow never reaches the coach. Fill
      the watch-page sidebar slot with it, loading a game's `pending` candidates. Composition only -
      no new suggestion logic. Owns: watch-page mount + a thin connector under
      `src/features/suggestions/**`.
- [x] `[W7]` P2-3: Comments UI on clips. The comments API and queries (P1-2) exist but there is no
      comment component anywhere. Build a read/write comment list against
      `GET`/`POST /api/clips/[id]/comments`, rendered beside the `PlaylistPlayer` on the team and
      per-player share links (login-free viewers pass their `?shareToken=`, already gated by
      `canShareTokenReachClip`) and for the signed-in coach. Owns:
      `src/features/clips/comments/**` (UI), share-view mount points.
- [x] `[W7]` P2-4: Surface the team share link to the coach. Per-player links are copyable via
      `ShareLinkField` on `/players`, but the team link (secret is the `TEAM_SHARE_TOKEN` env) has no
      surface - the coach would hand-build the URL. Add a copyable team-link field (reuse
      `ShareLinkField`) on a coach page, reading the token server-side (never exposed to the client
      bundle beyond the assembled URL). Owns: `src/features/share/**` (team-link surface) + its coach
      page mount. Done: `TeamShareLink` server surface mounted above the roster on `/players`.
- [x] `[W7]` P2-5: Coach quick-start guide. There is no user-facing doc for the actual workflow. Write
      a short `docs/project/coach-guide.md`: reference a game's chapter files -> tag with hotkeys ->
      confirm whistle suggestions -> cut and share clips -> rotate/revoke a link. Docs only. Owns:
      `docs/project/coach-guide.md`. Done: the guide walks drop-a-folder ingest (P2-9) with the
      manual "Neues Spiel" form as fallback -> quarters -> hotkey tagging in the immersive workspace
      -> cutting -> team / player / collection links -> rotation and erasure, every label checked
      against the content layers. The whistle-suggestion step is left out on purpose while P2-2's
      mount is deferred (see the scope note above).

## P2 - performance, playback, and auto-ingest

The wiring tasks above make the coach flow clickable; these raise it from "works" to "usable on a
full-length game": the in-browser player has to stay light, the coach needs real transport controls,
the look has to close the gap to the reference design system, and getting a game into the portal
should be a drop-a-folder step rather than manual chapter entry. Same flow per task: `wt new
<type>/<slug>` off `develop`, small commits, quality gate, PR into `develop`, `Refs: <id>`.

- [x] P2-6: Lighten the in-browser video player. A full game in the browser currently eats a lot of
      RAM and CPU (multi-chapter HTML5 video held in memory). Reduce the footprint: serve a downscaled
      lower-resolution proxy rendition for tagging, buffer/preload only around the current position
      instead of the whole timeline, and release off-screen chapter sources. Measure RAM/CPU before and
      after on a real game. Owns: `src/features/player/**` (playback + buffering), plus any
      proxy-rendition contract with `hockey-video-pipeline`.
- [x] P2-7: Playback transport controls. The coach needs proper fast-forward/rewind and play/pause on
      the watch player - variable-speed seek (e.g. 2x/4x scan), frame/second step, and a clear pause
      state - so scrubbing to a moment is fast without leaving the keyboard. Composition on the existing
      player controller over the global game-time mapping; no new time-mapping logic. Owns:
      `src/features/player/**` (transport) + `src/components/watch/**` chrome.
- [ ] P2-8: Close the design gap to the reference system. The current UI is noticeably rougher than the
      claude.ai/design "Hockey Video Analysis Design System" it was ported from. Do a visual-quality
      pass - spacing, hierarchy, component polish, motion - against that reference, staying on the DS
      tokens (no raw hex). Scope the findings first (screen-by-screen gap list), then land fixes as
      small scoped PRs in each screen's owning lane. Owns: `docs/design/**` (gap audit) + per-screen
      component PRs.
- [~] P2-9: Drop-a-folder game ingest. A coach drops the raw recording files into a watched folder
  (NAS, VPN share, or Mac - location-agnostic) and the game appears in the portal automatically:
  the ordered GoPro chapter files are concatenated into one game, `game_sources` and the recording
  date are filled from the files' metadata, and only the title is left for the coach to name.
  The file concatenation/stitching runs in `hockey-video-pipeline`; this repo owns the ingest
  endpoint that registers the assembled game (auto-create a `games` row + ordered `game_sources`,
  left in a needs-a-name state) and surfaces it in the games list. **No whistle processing in this
  flow** (see the scope note above). Owns: `src/app/api/ingest/**` + `src/features/games/**`
  (auto-create path). Status: the app side (`POST /api/ingest`, the needs-a-name state and its
  "Neu eingegangen" review, P2-18) is built, but the watcher was never built in
  `hockey-video-pipeline`, so nothing calls the endpoint and every game has been entered by hand. The deployment has no NAS either;
  [ADR 0008](../decisions/0008-google-drive-holds-originals.md) moves the originals to Google
  Drive and the watcher into this repo as P2-17, which completes this task. Meanwhile "Neues
  Spiel" reads each chapter's duration from the file, so the manual path needs no seconds.
- [~] P2-17: Import games from Google Drive. The coach uploads a game's GoPro chapters into a folder
  under the shared Drive root and nothing else: a worker in this repo (next to the clip worker,
  ADR 0007) polls the root through a read-only rclone mount, waits until a new folder has been
  quiet for a while, picks the game's parts, reads each part's duration and the recording date
  with ffprobe, encodes the 720p proxies (one at a time, low priority), and registers the game
  in the needs-a-name state; imported folders are tracked in the database by their name in the
  mount (the prefix of their chapters' paths), never moved on Drive. Rules agreed with the
  owner: only folders directly under the root are games, loose files there are ignored; a
  game's parts are the files named `halbzeit<N>`, `viertel<N>` or GoPro `GX..`/`GH..`
  (case-insensitive), ordered by N, and any other file (such as a goal clip `TorBWK.MP4`) is
  ignored; when ffprobe has no trustworthy recording date, the game is registered without one
  and P2-18's review asks the coach; the folders already on Drive when the worker first runs
  are not imported, only folders that appear later. See
  [ADR 0008](../decisions/0008-google-drive-holds-originals.md). Owns: the ingest worker
  (`src/features/ingest/**`, `scripts/ingest-worker.ts`), the `ingest_folders` table and its
  migration, the clip worker's source root (`scripts/clip-worker.ts`,
  `src/features/clips/cut/ffmpeg.ts`), the worker env keys in `.env.schema`/`.env.example`, the
  CI ffmpeg step, `docs/ops/**`. Status: part 1 (S3) is built and tested end to end on a fake
  Drive tree - folder detection with the quiet period, the part rules, `game_sources` rows,
  the proxy encode with a duration check, `MEDIA_SOURCE_ROOT` split from `CLIP_MEDIA_ROOT`, and
  the setup and switch-over steps in [`docs/ops/vps-setup.md`](../ops/vps-setup.md) (section
  6b) and [`docs/ops/google-drive-mount.md`](../ops/google-drive-mount.md); the service account
  and the mount at `/mnt/hockey-drive` are live on the VPS. Part 2 (S4), half-finished uploads:
  nothing is registered until every part reads with ffprobe, so a truncated part keeps the folder
  waiting; a folder rejected for a gap is looked at again when its parts change, so an
  out-of-order upload imports once the gap closes; parts that land after the import are appended
  while the game is still under review and only when they come after its chapters, and any other
  change (the game already accepted, parts removed or reordered) leaves the game alone and is
  logged and written to the folder's `detail` for the operator. Duplicate imports: a folder is
  never imported twice, after a worker restart, with overlapping runs, or after its game was
  discarded, and each row keeps its folder's game parts (names and sizes), so a folder renamed or
  copied on Drive is logged and not imported as a second game; deleting the original row is the
  deliberate re-import. Failed probes and encodes: ffprobe and ffmpeg run with timeouts, a folder
  whose parts ffprobe cannot read waits without a row and is retried with a growing wait, and an
  imported game stays hidden from the coach (`games.awaiting_proxies`) until every chapter has a
  proxy that passed the duration check; a failed, crashed or interrupted encode leaves no file
  behind and is retried with a growing wait and a logged reason. Left for part 2: deploy and switch the VPS over, and an end-to-end run
  with a real game.
- [x] P2-18: Review newly imported games. An imported game currently only shows "Name fehlt" in
      the games list. Give new games a short "Neu eingegangen" review list on "Spiele": the coach
      checks the date and chapters, sets title and opponent, and accepts or discards the game.
      Owns: `src/features/games/**` (review list + actions) + `src/app/games/**`. Done: games in the
      needs-a-name state (empty title) sit in their own list above the normal games and open
      `/games/<id>/review`, which replaces the old "Spiel benennen" screen. It shows the chapters in
      play order and asks for title, optional opponent and a required date (pre-filled when the
      import read one); "Übernehmen" moves the game into the normal list, "Spiel verwerfen"
      (confirm-gated) deletes the game and its `game_sources` rows, never the files. Both actions
      only match a game still under review. A discarded Drive import is not imported again: its
      `ingest_folders` row outlives the game (P2-17).

## P2 - analysis and sharing features

These push the coach flow past capture-and-share into deeper analysis and reusable collections. Same
flow per task: `wt new <type>/<slug>` off `develop`, small commits, quality gate, PR into `develop`,
`Refs: <id>`.

- [x] P2-10: Freehand telestration. On a paused frame, draw runs and passes over the video (arrows,
      circles, freehand) and share the annotated still or a short clip. The still is a client-side
      canvas overlay export; burning the drawing into a shared clip is a `hockey-video-pipeline` job.
      A focused subset of the Phase-5 "tactics modules" idea below. Owns:
      `src/features/player/telestration/**` (canvas overlay) + still-export path. Done (this
      repo's part): `D` or the transport switch pauses and opens the drawing layer on the stage
      (also in fullscreen), strokes live in picture coordinates so they survive resizes, and the
      still exports as a PNG at the video's native resolution. Any move of the frame (play, seek,
      step, chapter swap) discards the drawing. The export reads the frame's pixels, so it needs
      media served from the app's own origin; a cross-origin `MEDIA_BASE_URL` gets a clear
      "blocked" message (the `<video>` sets no `crossOrigin`, which would break playback on a
      host without CORS). The clip variant stays with `hockey-video-pipeline`.
- [x] P2-11: Slow-motion and frame-step analysis. Deliberate slow-motion playback and single-frame
      step forward/back for close analysis. Builds directly on P2-7's transport controls; no new
      time-mapping logic. Owns: `src/features/player/**` (transport).
- [x] P2-12: Game and team overview report. Per-game key figures (short corners, goals, good/bad
      actions) as a quick report with CSV export, derived from the game's existing tags - no new
      capture. Owns: `src/features/reports/**` + `src/app/games/[id]/report/**` +
      `src/app/reports/**`. Done (per game):
      `/games/[id]/report` ("Bericht" in the workspace rail) shows the per-type counts for the game,
      split by quarter (plus tags outside every quarter) and by linked player (plus tags with no
      player; a multi-player tag counts for each), and `/games/[id]/report/csv` downloads the same
      figures as one semicolon-separated, UTF-8-BOM, formula-injection-safe table. Done (team
      overview): `/reports` ("Berichte" in the primary nav) sums the same figures per game and per
      player over all games or an optional played-on date range (`?from=&to=`, inclusive; a set
      range skips undated games), each game linking to its own report, and `/reports/csv` exports
      them for the same range. `buildTeamReport` runs `buildGameReport` per game and sums the rows.
- [x] P2-13: Clip collections / playlists. Let a coach curate named collections ("Standards Woche 3")
      from ready clips and share each via its own secret link, reusing the login-free `ShareShell` and
      `PlaylistPlayer`. Needs a new `collections` + `collection_clips` table with its own
      `share_token` (a post-MVP schema addition - the P0-1 freeze covered the MVP waves only). Owns:
      `drizzle/**` (new tables), `src/features/share/collections/**` + its coach and share pages.
- [x] P2-14: Clean light mode. A polished light/white theme alongside the current one, driven entirely
      by the DS tokens (no raw hex), with a coach-facing toggle that persists. Owns: `src/styles/**`
      (theme token layer) + `src/components/shell/**` (toggle). Light theme restates only the semantic
      aliases under `:root[data-theme="light"]` (new `paper` scale); a header `ThemeToggle` flips
      `data-theme` on `<html>` and persists to `localStorage`, with a no-flash `ThemeScript` in
      `<head>`.
- [x] P2-15: Coach settings page (account + theme). The app has no home for coach-level
      preferences - the theme toggle and sign-out live only in the header, and there is no way
      to change a password. Add a `/settings` route reachable from the primary nav with a slim
      first cut: an Account section showing the signed-in coach's name and email (read-only)
      plus a change-password form (verify the current password, enforce the shared 8-char
      minimum, confirm the new one, then re-hash and rotate every session so other devices are
      logged out), an Appearance section wrapping the existing `ThemeToggle`, and a sign-out
      control reusing `SignOutForm`. Composition over the existing auth layer (`lib/auth`
      password/session helpers) and the access content pattern; no schema change. Owns:
      `src/features/settings/**` (change-password action + form) + `src/app/settings/**`
      (page) + a one-line `PRIMARY_NAV` addition. Sharing/token rotation and profile edits are
      deliberately out of this first cut. Done: the hash swap and the session revoke share one
      transaction, current-password guesses are rate limited per coach, and the panels use a
      labelled `ThemeToggle` and a bordered `SignOutForm`.

- [x] P2-16: Fullscreen tagging. Watching a full game means watching the picture, not the
      workspace around it - but the coach still has to tag while doing it. Hand the video stage
      (not the page) to the Fullscreen API from `F` and a transport switch, drop the rails, top
      bar and timeline, and move the tag-capture buttons onto the stage so the hotkeys keep
      capturing and the confirmation reads back over the frame instead of in the off-screen tags
      rail. Composition over the existing player controller and `useTagCapture`; no new capture or
      time-mapping logic. Owns: `src/features/player/**` (stage + fullscreen state) +
      `src/lib/fullscreen/**` (wrappers shared with presentation mode). Done: `FullscreenStageChrome`
      with an idle fade, the tag slot rendered in exactly one place at a time so a key press never
      captures twice.

- [ ] P2-19: Bug - the drawing (telestration) and fullscreen buttons vanish in a narrower window.
      `PlayerTransport` lays its row out as a single non-wrapping flex line: the transport cluster,
      the clock, then an `ms-auto` group with the tag buttons, the pen toggle and the fullscreen
      switch. Once that row is wider than the video column, the right-hand group runs past the
      edge and is cut off by the workspace grid's `overflow-hidden`, so the coach sees no way to
      draw or go fullscreen until the window is enlarged (the `F` hotkey still works). Reported
      on production after the #124 release. Fix the row so every control stays reachable at any
      supported width (wrap, collapse the tag buttons, or move the pen/fullscreen pair ahead of
      them) and check it in the browser at laptop widths with a full set of tag buttons. Owns:
      `src/features/player/PlayerTransport.tsx` (+ `src/features/tagging/TransportTagButtons.tsx`
      if the tag group changes).
- [x] P2-20: No autoplay in collections. A collection link played each clip as soon as it was
      picked and ran straight on to the next one, so a player could not stop and look at a clip
      before the following one began. On the collection link nothing starts or advances on its
      own now: a picked clip loads paused, a finished clip stops on its last frame with "Nochmal
      abspielen" and "Nächster Clip", and next/previous happen only on the viewer's action. The
      same applies inside its "Präsentationsmodus". The team and player links keep playing
      through. `PlaylistPlayer` and `PresentationMode` take a `playback` mode (`continuous` by
      default, `manual` on the collection link) backed by the pure `playsOnSelect` /
      `indexAfterEnd` rules in `playlist-navigation.ts`. Owns: `src/features/share/playlist/**`,
      `src/features/share/presentation/**`, `src/app/share/collection/**`.
- [~] P2-21: Collection insights. Show the coach how a shared collection lands: clicks, full views,
  replays and unique viewers per clip and per collection, the comments, and the coach's own
  comments pinned or as a clip's title and subtitle. Three slices. Slice 1 (done): the
  collection link counts views anonymously (ADR 0009) - `collection_view_events`,
  `POST /api/collection-views`, and `getCollectionViewStats` for the figures; no cookies, no
  stored IP address or user agent, a viewer key under a daily-rotating in-memory salt. Slice 2:
  the coach's insights view with the figures and comments. Slice 3: the coach's own comments,
  pinned or as clip title/subtitle. Owns: `src/features/share/views/**`,
  `src/app/api/collection-views/**`, `drizzle/**` (new table), the collection share players.

## AC - open-source auto camera

The 12-month plan lives in [`roadmap-auto-camera.md`](roadmap-auto-camera.md). Each sprint is
promoted to one `AC-<sprint>` task here when it starts; the sprint's checklist (core, then stretch)
stays in the roadmap and is ticked there, so it is not duplicated below. Early sprints are hardware
and measurement work with no code in this repo; they are tracked here so the whole year has one
task list.

- [ ] AC-1: Sprint S1 (2026-09-28 to 2026-10-11) - hardware and first recording. Get the second
      GoPro and a 5-6 m mount, build the dual mount, write the recording checklist, install
      `reco-cli` v0.5.4 `macos-arm64` on the M4, record at least 10 minutes of a training session,
      and calibrate. Done when the roadmap's S1 core items are ticked. No code; the recording
      checklist and hardware notes land in `docs/research/`. Owns: `docs/research/**`,
      `docs/project/roadmap-auto-camera.md` (S1 ticks).

## Later

Out of scope for the MVP; captured so they are not lost. Promote to numbered tasks when the team
picks them up.

- Time-coded comments _within_ a clip (PRD 5.6, Phase 2 optional).
- Precision clip mode with re-encoding on the M4, if keyframe tolerance proves too coarse (PRD
  5.4, risk 3).
- Decoupled tactics modules: pen tool for runs/passes on a paused frame, tactics board, game
  clock (PRD Phase 5).
- YOLO / player tracking (PRD Phase 6 - optional, standalone sub-project). Now planned as the
  open-source auto camera in [`roadmap-auto-camera.md`](roadmap-auto-camera.md); its sprint items
  are promoted to numbered tasks here as each sprint starts.
- Optional native Mac app (SwiftUI) for local file access and a pipeline GUI (PRD s7).
