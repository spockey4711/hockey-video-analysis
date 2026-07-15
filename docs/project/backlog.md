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

- [ ] `[W7]` P2-1: Clip creation and cut-status in the watch page. The `POST /api/clips` route and
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
- [ ] `[W7]` P2-4: Surface the team share link to the coach. Per-player links are copyable via
      `ShareLinkField` on `/players`, but the team link (secret is the `TEAM_SHARE_TOKEN` env) has no
      surface - the coach would hand-build the URL. Add a copyable team-link field (reuse
      `ShareLinkField`) on a coach page, reading the token server-side (never exposed to the client
      bundle beyond the assembled URL). Owns: `src/features/share/**` (team-link surface) + its coach
      page mount.
- [ ] `[W7]` P2-5: Coach quick-start guide. There is no user-facing doc for the actual workflow. Write
      a short `docs/project/coach-guide.md`: reference a game's chapter files -> tag with hotkeys ->
      confirm whistle suggestions -> cut and share clips -> rotate/revoke a link. Docs only. Owns:
      `docs/project/coach-guide.md`.

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
