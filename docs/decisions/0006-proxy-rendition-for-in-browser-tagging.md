# 0006 - Serve a downscaled proxy rendition to the tagging player

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Yannik
- **Supersedes:** none
- **Superseded by:** none

## Context

A game's chapter files are full-resolution GoPro recordings (multi-GB, 1080p/4K). The watch page
loads them straight into an HTML5 `<video>` for tagging, so the coach's browser decodes and
buffers full-resolution video for an entire game. That burns RAM and CPU (P2-6), and tagging does
not need full resolution - the coach only needs to see the action well enough to mark moments.

Two constraints shape the options:

- The `game_sources` schema is fixed since P0-1 ([0002](0002-global-game-time-offset-model.md));
  a chapter row has only `file_path` and `duration_s`, and adding a `proxy_path` column is out of
  scope for this task.
- Full resolution is still required server-side: clips are cut from the original files by the
  `hockey-video-pipeline` worker ([0004](0004-copy-cut-clips-with-keyframe-tolerance.md)), so the
  proxy is a playback convenience, not a replacement for the source.

The full stream is also downloaded progressively into a plain `<video src>`, whose forward buffer
the browser manages and which cannot be capped without Media Source Extensions (segmented media).

## Decision

We serve the tagging player a **downscaled proxy rendition** resolved purely by URL convention,
with no schema change:

- A server-only `MEDIA_PROXY_BASE_URL` names a parallel media root. A chapter's proxy lives at the
  **same relative path** as the chapter under that root (full `${MEDIA_BASE_URL}/HSV/ch1.mp4` ->
  proxy `${MEDIA_PROXY_BASE_URL}/HSV/ch1.mp4`).
- `toPlayerSources` (`src/features/player/player-sources.ts`) resolves each chapter's playback URL
  against `MEDIA_PROXY_BASE_URL` when set, falling back to `MEDIA_BASE_URL` otherwise. Only the URL
  changes; `duration_s` is copied through unchanged.
- The proxy re-encode (produced by `hockey-video-pipeline`) **must preserve duration and timebase**
  so the `(chapter, local offset)` mapping and every tag timestamp stay valid against either
  rendition. Recommended target: ~720p, same container/codec family as the source. Resolution and
  bitrate are the pipeline's call; only the path convention and duration are contractual.

We also release the decoder and buffered bytes promptly when the player unmounts, rather than
relying on garbage collection.

We deliberately do **not** cap the forward buffer. A plain progressive `<video>` cannot bound its
buffer without Media Source Extensions; introducing MSE/HLS-segmented playback is a larger change
with a new dependency and a pipeline segmentation contract, deferred as future work. The proxy is
what makes the still-unbounded buffer cheap (720p bytes and decode instead of 4K).

Alternatives rejected: adding a `proxy_path` column (schema is frozen); a filename-suffix
convention such as `ch1.proxy.mp4` in the same directory (couples proxy layout to the source tree
and complicates the pipeline's output paths); and building MSE now (disproportionate to the win the
proxy already delivers).

## Consequences

- The browser decodes and buffers a fraction of the bytes during tagging, cutting RAM and CPU on
  the coach's machine - the core P2-6 goal - with no schema migration.
- `hockey-video-pipeline` gains a job: produce a duration-preserving downscaled proxy per chapter
  under the proxy root, mirroring the chapter path. Until it does, leaving `MEDIA_PROXY_BASE_URL`
  unset keeps the player on full resolution, so this ships safely ahead of the pipeline work.
- A proxy whose duration drifts from its source would desync tags and clip cuts; duration
  preservation is therefore a hard requirement on the pipeline, not a nicety.
- Forward buffering stays browser-managed. If proxy playback still buffers too aggressively on real
  games, MSE/segmented playback is the escape hatch and would revisit this decision.
- Measuring the win is a manual before/after check; see
  [measuring player footprint](../ops/measuring-player-footprint.md).
