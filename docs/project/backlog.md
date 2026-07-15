# Backlog

The prioritized task list - the source of truth for what to build next. Reference an id in
commits and PRs (e.g. `Refs: P0-1`). Task markers: `- [ ]` todo, `- [x]` done, `- [~]` merged
with a follow-up still pending (see the task lifecycle in `docs/engineering/git-workflow.md`).

Scope: this is the **web app** (coach tagging + clip sharing). The Python double-whistle
detector and the ffmpeg cut-worker live in the sibling project `hockey-video-pipeline`; tasks
here cover only the app's side of those integrations (enqueue jobs, show suggestions).

## P0 - core: tag a game and share clips

- [ ] P0-1: Stand up the Next.js app shell and Postgres schema. Create tables for `games`,
  `game_sources`, `players`, `tags`, `tag_players`, `clips`, `comments`, `quarters` per PRD s6,
  with migrations; wire the `postgres` and `auth` flavors (see `docs/flavors/`).
- [ ] P0-2: Coach login. Coaches authenticate to create/edit content; players and team get
  read-only access via secret links (no login). Tags and content carry an `author` so parallel
  coaches are distinguishable (PRD s2).
- [ ] P0-3: Create a game and attach ordered chapter files. Coach enters title/date/opponent and
  references 1..N source file paths in order (files already live on the NAS - no re-upload); each
  file's duration is recorded in `game_sources` (PRD 5.1).
- [ ] P0-4: Global time-mapping utility. Central function converting a global game-time offset
  <-> (source file, local offset), computed from `game_sources.duration_s`. Shared contract with
  the player and the pipeline worker (PRD s3, ADR 0002).
- [ ] P0-5: Continuous multi-chapter player. Play the N chapter files as one seamless game
  timeline using the mapping, so the coach scrubs game time, not file time (PRD 5.2).
- [ ] P0-6: Hotkey tagging. A keypress captures the current global time plus a tag type (Tor,
  Ecke kurz, Aktion gut, Aktion schlecht). Each tag gets a per-type default window (e.g. start
  -8s, end +4s); an explicit end time is optional. Tags carry `author` and `source: manual`
  (PRD 5.2).
- [ ] P0-7: Link tags to players and set visibility. A tag can reference one or more players
  (`tag_players`, n:m) and has visibility `team` or `single` (player-specific) (PRD 5.2).
- [ ] P0-8: Edit and delete tags. Tags are editable and deletable after capture (PRD 5.2).
- [ ] P0-9: Enqueue clip jobs and track status. From confirmed tags, create `clips` rows with
  `status` (pending/processing/ready/failed) and `output_path`, and enqueue them for the
  `hockey-video-pipeline` worker to cut (PRD 5.4).
- [ ] P0-10: Team clip view via secret link. A secret link lists all team-visible ready clips,
  playable as a playlist, with no login and `noindex` / no directory listing (PRD 5.5, s8).
- [ ] P0-11: Per-player clip view via secret link. Each player has a `share_token` link showing
  their single clips plus all team-wide clips, as a playlist (PRD 5.5).

## P1 - rounds out the MVP

- [ ] P1-1: Instant jump-marker mode. Let the coach jump between tag markers in the player
  without waiting for cut clips, so the team can use tagging the moment a game is loaded (PRD
  Phase 1, s11 Option A).
- [ ] P1-2: Comments on clips. Author, text and created-at on a clip (PRD 5.6).
- [ ] P1-3: Configurable tag types and windows. Make the tag-type set and each type's default
  start/end window configurable rather than hard-coded (PRD 5.2).
- [ ] P1-4: Quarter split. Set the four quarter boundaries (manual) to enable timeline navigation
  and per-quarter clip creation; store in `quarters` (PRD 5.3).
- [ ] P1-5: Whistle-suggestion review. Show double-whistle candidate timestamps produced by
  `hockey-video-pipeline` as goal suggestions the coach confirms or rejects - never auto-commit,
  because spectator whistles cause false positives (PRD 5.3).
- [ ] P1-6: Share-token rotation and player deletion (GDPR). Rotate/invalidate a `share_token` so
  a link can be revoked, and delete a player together with their single clips and tag links
  (PRD s8).
- [ ] P1-7: Chapter-boundary clips. Handle tags/clips whose window crosses a source-file boundary
  cleanly, rather than clamping at the chapter edge (PRD s3, risk 2).
- [ ] P1-8: Presentation mode. Fullscreen playlist with a next button for team sessions (PRD
  Phase 4).

## Later

Out of scope for the MVP; captured so they are not lost. Promote to P-tasks when the team picks
them up.

- Time-coded comments *within* a clip (PRD 5.6, Phase 2 optional).
- Precision clip mode with re-encoding on the M4, if keyframe tolerance proves too coarse (PRD
  5.4, risk 3).
- Decoupled tactics modules: pen tool for runs/passes on a paused frame, tactics board, game
  clock (PRD Phase 5).
- YOLO / player tracking (PRD Phase 6 - optional, standalone sub-project).
- Optional native Mac app (SwiftUI) for local file access and a pipeline GUI (PRD s7).
