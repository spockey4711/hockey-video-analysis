# Backlog

The prioritized task list - the source of truth for what to build next. Reference an id in
commits and PRs (e.g. `Refs: P0-1`). Task markers: `- [ ]` not started, `- [~]` in progress or
done-but-incomplete, `- [x]` fully done. Check the box before the merge PR, not after. Use `- [x]`
only when nothing is left to do; use `- [~]` whenever concrete steps still remain (a CLI command,
server/route wiring, a follow-up). Once a task is started it is never left `- [ ]` - an in-progress
task is `- [~]` (see the task lifecycle in `docs/engineering/git-workflow.md`).

Scope: this is the **web app** (coach tagging + clip sharing). The Python double-whistle
detector and the ffmpeg cut-worker live in the sibling project `hockey-video-pipeline`; tasks
here cover only the app's side of those integrations (enqueue jobs, show suggestions).

## Parallel execution waves (4 lanes)

The tasks are grouped into **waves of ~4** so four cloud instances can each take one task and
work in parallel with minimal merge friction. Each task carries a badge: `[W1]`..`[W5]`.

Rules that keep the four lanes conflict-free:

- **Waves are sequential; tasks within a wave are parallel.** Finish and merge a whole wave into
  `develop` before starting the next - each wave builds on the schema/shell/contracts the
  previous one landed.
- **One task owns one directory.** The "owns" column below is the only place that task writes.
  If two lanes would touch the same file, that is called out as a coordination point - keep the
  shared file in one lane and consume it from the other via its public interface.
- **All migrations live in P0-1.** P0-1 creates the full schema (every table in PRD s6) up
  front, so no later task ever edits `drizzle/` - that removes the single biggest conflict
  source. Later tasks only add queries against existing tables.
- **The watch page and the share playlist are shared shells.** The lane that creates each
  (P0-5 watch page, P0-10 playlist component) leaves typed slots; sibling lanes add child
  components rather than editing the shell.
- Standard flow per task: `wt new <type>/<slug>` off `develop`, small commits, quality gate,
  PR into `develop`, `Refs: <id>`. See `docs/engineering/git-workflow.md`.

| Wave | Tasks                              | Theme                                                                   |
| ---- | ---------------------------------- | ----------------------------------------------------------------------- |
| W1   | P0-1, P0-2, P0-4, P1-3, DS-1, DS-2 | Foundation: schema + shell, auth, pure libs, design tokens + primitives |
| W2   | P0-3, P0-5, P0-6, P1-4, DS-3       | Games, player, tag capture, quarters, domain components                 |
| W3   | P0-7, P0-9, P1-1, P1-5             | Tag links, clip jobs, jump mode, whistle review                         |
| W4   | P0-8, P0-10, P0-11, P1-2           | Tag edit, share views, comments                                         |
| W5   | P1-6, P1-7, P1-8                   | GDPR/rotation, boundary clips, presentation                             |

Owned paths per task (write only here):

| Task  | Owns (write here)                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------- |
| DS-1  | `src/styles/**` (tokens + global entry), `docs/design/**`                                               |
| DS-2  | `src/components/core/**`, `src/components/forms/**`                                                     |
| DS-3  | `src/components/data/**`                                                                                |
| P0-1  | `drizzle/**` (all tables), `src/lib/db/**`, `src/app/layout.tsx`, `src/app/page.tsx`, root/build config |
| P0-2  | `src/lib/auth/**`, `src/middleware.ts`, `src/app/(auth)/**`, `src/features/access/**`                   |
| P0-4  | `src/lib/time-mapping/**`                                                                               |
| P1-3  | `src/lib/tag-types/**` (config module the tagging UI consumes)                                          |
| P0-3  | `src/features/games/**`, `src/app/games/**` (list/create), `src/app/api/games/**`                       |
| P0-5  | `src/features/player/**`, `src/app/games/[id]/watch/**` (shell + slots)                                 |
| P0-6  | `src/features/tagging/**`, `src/app/api/tags/**`                                                        |
| P1-4  | `src/features/quarters/**`, `src/app/api/quarters/**`                                                   |
| P0-7  | `src/features/tag-players/**`, `src/app/api/tags/[id]/players/**`                                       |
| P0-9  | `src/features/clips/**`, `src/app/api/clips/**`                                                         |
| P1-1  | `src/features/player/jump-markers/**`                                                                   |
| P1-5  | `src/features/suggestions/**`, `src/app/api/suggestions/**`                                             |
| P0-8  | `src/features/tagging/edit/**`, `src/app/api/tags/[id]/**`                                              |
| P0-10 | `src/features/share/**` (incl. shared `PlaylistPlayer`), `src/app/share/team/**`                        |
| P0-11 | `src/app/share/player/**` (consumes `PlaylistPlayer` from P0-10)                                        |
| P1-2  | `src/features/clips/comments/**`, `src/app/api/clips/[id]/comments/**`                                  |
| P1-6  | `src/features/access/rotation/**`, `src/features/players/gdpr/**`                                       |
| P1-7  | `src/lib/time-mapping/boundaries/**`, `src/features/clips/boundary/**`                                  |
| P1-8  | `src/features/share/presentation/**`                                                                    |

Coordination points (single unavoidable touch-shared, keep in the named lane):

- **P0-10 <-> P0-11:** P0-10 builds `PlaylistPlayer`; P0-11 imports it. Land P0-10's component
  early in the wave so P0-11 consumes a stable prop contract.
- **P1-6 <-> P1-7 (clips):** both read `clips`; neither edits the other's files - the schema is
  fixed since P0-1, so this is query-only and non-conflicting.
- **DS-1 -> P0-1:** DS-1 lands `src/styles/globals.css`; P0-1 imports it in `layout.tsx` and
  migrates the CDN font `@import` in `tokens/fonts.css` to `next/font`. The touch stays in P0-1's
  lane (it owns `layout.tsx` and build config).
- **DS-2 -> feature lanes:** land the DS-2 primitives early in W1 so every W2+ UI task imports
  `src/components/*` rather than restyling controls from scratch.

## DS - design system

Ported from the claude.ai design project "Hockey Video Analysis Design System" (see
[`docs/design/README.md`](../design/README.md)). The tokens are the shared contract every UI task
consumes; reference the semantic aliases and never raw hex in components.

- [x] `[W1]` DS-1: Import the design-system foundation. Land the design tokens
      (`src/styles/tokens/*.css`) and the global entry stylesheet (`src/styles/globals.css`), plus the
      `docs/design/` reference. No app wiring in this task - `P0-1` imports `globals.css` in the shell.
- [x] `[W1]` DS-2: Build the primitive components. Port `Card`, `Icon`, `Button`, `IconButton`,
      `Input`, `Select`, `Switch` to production React/TS + Tailwind under `src/components/core/**` and
      `src/components/forms/**`, styled from the tokens (no raw hex) with tests. Land early in W1 so the
      feature lanes import them rather than restyling controls.
- [ ] `[W2]` DS-3: Build the domain components. Port `TagChip`, `StatusBadge`, `Timecode`,
      `PlayerChip`, `Kbd` to `src/components/data/**`. `Timecode` formats via the `P0-4` time-mapping
      contract; `TagChip` reads the tag-type set from `P1-3`'s config module.

## P0 - core: tag a game and share clips

- [x] `[W1]` P0-1: Stand up the Next.js app shell and Postgres schema. Create tables for `games`,
      `game_sources`, `players`, `tags`, `tag_players`, `clips`, `comments`, `quarters` per PRD s6,
      with migrations; wire the `postgres` and `auth` flavors (see `docs/flavors/`). Create the full
      schema now so no later task touches `drizzle/`.
- [~] `[W1]` P0-2: Coach login. Coaches authenticate to create/edit content; players and team get
  read-only access via secret links (no login). Tags and content carry an `author` so parallel
  coaches are distinguishable (PRD s2). Auth layer landed (scrypt password hashing, DB-backed
  sessions, invite-gated signup, login/logout, `requireCoach()`/`getCurrentCoach()` guards,
  edge middleware); a logout control still needs wiring into the coach app shell once a later
  UI task provides one.
- [ ] `[W1]` P0-4: Global time-mapping utility. Central function converting a global game-time offset
      <-> (source file, local offset), computed from `game_sources.duration_s`. Shared contract with
      the player and the pipeline worker (PRD s3, ADR 0002). Pure lib, no DB dependency.
- [ ] `[W2]` P0-3: Create a game and attach ordered chapter files. Coach enters title/date/opponent and
      references 1..N source file paths in order (files already live on the NAS - no re-upload); each
      file's duration is recorded in `game_sources` (PRD 5.1).
- [ ] `[W2]` P0-5: Continuous multi-chapter player. Play the N chapter files as one seamless game
      timeline using the mapping, so the coach scrubs game time, not file time (PRD 5.2). Owns the
      watch page shell; leave typed slots for tagging and quarter overlays.
- [ ] `[W2]` P0-6: Hotkey tagging. A keypress captures the current global time plus a tag type (Tor,
      Ecke kurz, Aktion gut, Aktion schlecht). Each tag gets a per-type default window (e.g. start
      -8s, end +4s); an explicit end time is optional. Tags carry `author` and `source: manual`
      (PRD 5.2). Reads tag types from P1-3's config module.
- [ ] `[W3]` P0-7: Link tags to players and set visibility. A tag can reference one or more players
      (`tag_players`, n:m) and has visibility `team` or `single` (player-specific) (PRD 5.2).
- [ ] `[W3]` P0-9: Enqueue clip jobs and track status. From confirmed tags, create `clips` rows with
      `status` (pending/processing/ready/failed) and `output_path`, and enqueue them for the
      `hockey-video-pipeline` worker to cut (PRD 5.4).
- [ ] `[W4]` P0-8: Edit and delete tags. Tags are editable and deletable after capture (PRD 5.2).
- [ ] `[W4]` P0-10: Team clip view via secret link. A secret link lists all team-visible ready clips,
      playable as a playlist, with no login and `noindex` / no directory listing (PRD 5.5, s8). Owns
      the shared `PlaylistPlayer` component reused by P0-11.
- [ ] `[W4]` P0-11: Per-player clip view via secret link. Each player has a `share_token` link showing
      their single clips plus all team-wide clips, as a playlist (PRD 5.5). Consumes `PlaylistPlayer`
      from P0-10.

## P1 - rounds out the MVP

- [ ] `[W3]` P1-1: Instant jump-marker mode. Let the coach jump between tag markers in the player
      without waiting for cut clips, so the team can use tagging the moment a game is loaded (PRD
      Phase 1, s11 Option A).
- [ ] `[W4]` P1-2: Comments on clips. Author, text and created-at on a clip (PRD 5.6).
- [ ] `[W1]` P1-3: Configurable tag types and windows. Make the tag-type set and each type's default
      start/end window configurable rather than hard-coded (PRD 5.2). Ship as a standalone config
      module that P0-6 consumes.
- [ ] `[W2]` P1-4: Quarter split. Set the four quarter boundaries (manual) to enable timeline navigation
      and per-quarter clip creation; store in `quarters` (PRD 5.3).
- [ ] `[W3]` P1-5: Whistle-suggestion review. Show double-whistle candidate timestamps produced by
      `hockey-video-pipeline` as goal suggestions the coach confirms or rejects - never auto-commit,
      because spectator whistles cause false positives (PRD 5.3).
- [ ] `[W5]` P1-6: Share-token rotation and player deletion (GDPR). Rotate/invalidate a `share_token` so
      a link can be revoked, and delete a player together with their single clips and tag links
      (PRD s8).
- [ ] `[W5]` P1-7: Chapter-boundary clips. Handle tags/clips whose window crosses a source-file boundary
      cleanly, rather than clamping at the chapter edge (PRD s3, risk 2).
- [ ] `[W5]` P1-8: Presentation mode. Fullscreen playlist with a next button for team sessions (PRD
      Phase 4).

## Later

Out of scope for the MVP; captured so they are not lost. Promote to P-tasks when the team picks
them up.

- Time-coded comments _within_ a clip (PRD 5.6, Phase 2 optional).
- Precision clip mode with re-encoding on the M4, if keyframe tolerance proves too coarse (PRD
  5.4, risk 3).
- Decoupled tactics modules: pen tool for runs/passes on a paused frame, tactics board, game
  clock (PRD Phase 5).
- YOLO / player tracking (PRD Phase 6 - optional, standalone sub-project).
- Optional native Mac app (SwiftUI) for local file access and a pipeline GUI (PRD s7).
</content>

</invoke>
