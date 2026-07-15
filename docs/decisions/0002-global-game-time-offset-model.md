# 0002 - Global game-time offset as the single time coordinate

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Yannik
- **Supersedes:** none
- **Superseded by:** none

## Context

A GoPro splits a long recording automatically at ~4 GB into several files ("chapters"). One
hockey game is therefore N separate files that together form a single continuous recording. Every
part of the system - the video player, the clip-cutting worker, and the audio whistle detector -
needs to agree on *when* an event happened. If each component reasoned in file-relative time,
every timestamp would be ambiguous ("12s into which file?") and each component would have to
re-derive the file boundaries on its own, with drift and off-by-one bugs across components (PRD
s3).

## Decision

We use a single time coordinate throughout the system: the **global game-time offset**, in
seconds since the start of the game, independent of which chapter file a moment falls in.

- A `Game` references an ordered list of source files (`game_sources`), each with a known
  duration (`duration_s`).
- One central mapping function converts a global offset <-> (source file, local offset), derived
  from the ordered durations. It is not stored; it is computed from `game_sources`.
- All timestamps persisted in the system (tags, clip start/end, quarter boundaries, whistle
  candidates) are global offsets. The mapping is applied only at the edges - when the player seeks,
  when the worker cuts, when the detector reports.

Alternatives rejected: storing file-relative timestamps (ambiguous, couples every consumer to the
chapter layout) and concatenating the chapters into one physical file up front (forces a full
re-encode / large copy the hardware split is meant to avoid).

## Consequences

- Player, cut-worker and audio detector share one unambiguous vocabulary; a tag captured in the UI
  cuts to the right frame without any component knowing the chapter layout.
- The mapping function is load-bearing and shared across two projects
  (`hockey-video-analysis` and `hockey-video-pipeline`); its contract must stay identical on both
  sides, and it needs solid unit tests around chapter boundaries.
- Events whose window crosses a chapter boundary are a real case the mapping must express
  (start in file i, end in file i+1); the worker has to handle the split (see backlog P1-7 /
  pipeline P1-3, PRD risk 2).
- Re-ordering or re-importing source files changes every global offset for that game, so
  `game_sources.order_index` must be treated as stable once tagging has begun.
