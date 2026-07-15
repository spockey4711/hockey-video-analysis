# Backlog

The prioritized task list - the source of truth for what to build next. Reference an id in
commits and PRs (e.g. `Refs: P2-1`). Task markers: `- [ ]` not started, `- [~]` in progress or
done-but-incomplete, `- [x]` fully done. Check the box before the merge PR, not after. Use `- [x]`
only when nothing is left to do; use `- [~]` whenever concrete steps still remain (a CLI command,
server/route wiring, a follow-up). Once a task is started it is never left `- [ ]` - an in-progress
task is `- [~]` (see the task lifecycle in `docs/engineering/git-workflow.md`).

Scope: this is the **web app** (coach tagging + clip sharing). The Python double-whistle
detector and the ffmpeg cut-worker live in the sibling project `hockey-video-pipeline`; tasks
here cover only the app's side of those integrations (enqueue jobs, show suggestions).

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
- [ ] `[W7]` P2-3: Comments UI on clips. The comments API and queries (P1-2) exist but there is no
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
- [ ] `[W7]` P2-5: Coach quick-start guide. There is no user-facing doc for the actual workflow. Write
      a short `docs/project/coach-guide.md`: reference a game's chapter files -> tag with hotkeys ->
      confirm whistle suggestions -> cut and share clips -> rotate/revoke a link. Docs only. Owns:
      `docs/project/coach-guide.md`.

## P2 - performance, playback, and auto-ingest

The wiring tasks above make the coach flow clickable; these raise it from "works" to "usable on a
full-length game": the in-browser player has to stay light, the coach needs real transport controls,
the look has to close the gap to the reference design system, and getting a game into the portal
should be a drop-a-folder step rather than manual chapter entry. Same flow per task: `wt new
<type>/<slug>` off `develop`, small commits, quality gate, PR into `develop`, `Refs: <id>`.

- [ ] P2-6: Lighten the in-browser video player. A full game in the browser currently eats a lot of
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
- [x] P2-9: Drop-a-folder game ingest. A coach drops the raw recording files into a watched folder
      (NAS, VPN share, or Mac - location-agnostic) and the game appears in the portal automatically:
      the ordered GoPro chapter files are concatenated into one game, `game_sources` and the recording
      date are filled from the files' metadata, and only the title is left for the coach to name.
      The file concatenation/stitching runs in `hockey-video-pipeline`; this repo owns the ingest
      endpoint that registers the assembled game (auto-create a `games` row + ordered `game_sources`,
      left in a needs-a-name state) and surfaces it in the games list. **No whistle processing in this
      flow** (see the scope note above). Owns: `src/app/api/ingest/**` + `src/features/games/**`
      (auto-create path).

## P2 - analysis and sharing features

These push the coach flow past capture-and-share into deeper analysis and reusable collections. Same
flow per task: `wt new <type>/<slug>` off `develop`, small commits, quality gate, PR into `develop`,
`Refs: <id>`.

- [ ] P2-10: Freehand telestration. On a paused frame, draw runs and passes over the video (arrows,
      circles, freehand) and share the annotated still or a short clip. The still is a client-side
      canvas overlay export; burning the drawing into a shared clip is a `hockey-video-pipeline` job.
      A focused subset of the Phase-5 "tactics modules" idea below. Owns:
      `src/features/player/telestration/**` (canvas overlay) + still-export path.
- [ ] P2-11: Slow-motion and frame-step analysis. Deliberate slow-motion playback and single-frame
      step forward/back for close analysis. Builds directly on P2-7's transport controls; no new
      time-mapping logic. Owns: `src/features/player/**` (transport).
- [ ] P2-12: Game and team overview report. Per-game key figures (short corners, goals, good/bad
      actions) as a quick report with CSV export, derived from the game's existing tags - no new
      capture. Owns: `src/features/reports/**` + `src/app/games/[id]/report/**`.
- [ ] P2-13: Clip collections / playlists. Let a coach curate named collections ("Standards Woche 3")
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

## Later

Out of scope for the MVP; captured so they are not lost. Promote to numbered tasks when the team
picks them up.

- Time-coded comments _within_ a clip (PRD 5.6, Phase 2 optional).
- Precision clip mode with re-encoding on the M4, if keyframe tolerance proves too coarse (PRD
  5.4, risk 3).
- Decoupled tactics modules: pen tool for runs/passes on a paused frame, tactics board, game
  clock (PRD Phase 5).
- YOLO / player tracking (PRD Phase 6 - optional, standalone sub-project).
- Optional native Mac app (SwiftUI) for local file access and a pipeline GUI (PRD s7).
