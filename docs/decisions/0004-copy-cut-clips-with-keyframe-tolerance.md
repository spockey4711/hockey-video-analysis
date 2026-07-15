# 0004 - Cut clips with `-c copy`, accepting keyframe tolerance

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Yannik
- **Supersedes:** none
- **Superseded by:** none

## Context

Clips are produced from confirmed tags, potentially many per game. Re-encoding each clip would be
CPU-heavy and slow, and the always-on machine that serves the app (the VPS) must not carry that
load (see [0003](0003-hardware-role-split.md)). ffmpeg can instead copy the compressed stream
without re-encoding (`-c copy`), which is near-instant and light, but it can only start a clip at a
keyframe, so the actual cut point drifts by up to a keyframe interval from the requested time
(PRD 5.4, risk 3).

## Decision

We cut clips with `ffmpeg -ss ... -t ... -c copy` (no re-encoding) and accept keyframe tolerance of
roughly +/-1-2s on clip boundaries as the default. A frame-accurate "precision mode" using
re-encoding on the M4 is deliberately deferred and added later only for clips where the tolerance
proves too coarse.

Alternatives rejected: re-encoding every clip by default (too slow and too heavy for the VPS, for a
precision the coaching use case does not need) and forcing a fixed pre-roll to hide the drift
(does not actually make the cut accurate).

## Consequences

- Clip generation is fast and cheap enough to run on the VPS, keeping the whole tag -> clip loop
  quick.
- Clip boundaries are approximate; the default per-tag window (e.g. start -8s, end +4s) already
  pads for this, so the tolerance is usually invisible in practice.
- If keyframe drift turns out to be too coarse in real use, precision mode is the escape hatch and
  may need to be pulled forward (PRD risk 3, pipeline backlog P1-5).
- Clips whose window crosses a chapter boundary interact with this decision and the global-time
  model ([0002](0002-global-game-time-offset-model.md)); they are handled as a follow-up
  (PRD risk 2).
