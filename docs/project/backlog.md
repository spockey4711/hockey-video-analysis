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
