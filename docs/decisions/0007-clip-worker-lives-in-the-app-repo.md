# 0007 - The clip cut worker lives in the app repo

- **Status:** Accepted
- **Date:** 2026-09-22
- **Deciders:** Yannik
- **Supersedes:** none
- **Superseded by:** none

Amends [ADR 0003](0003-hardware-role-split.md), which assigned the cut-worker to the sibling
`hockey-video-pipeline` repo. The hardware split in 0003 is unchanged.

## Context

ADR 0003 put two very different jobs in the same repo because both involve video:

- **Double-whistle detection** - audio analysis over a whole game, numpy/scipy work, batch-run on
  the M4.
- **Clip cutting** - claim a `pending` row from `clips`, call `ffmpeg -c copy` with two offsets,
  write `status` and `output_path` back.

Only the first is a pipeline. The second is a small consumer of this app's database, and putting it
in another repo and another language made it carry copies of things this repo already owns:

- The queue protocol and the `clips` / `tags` / `game_sources` columns, as hand-written SQL. The
  schema is this app's (drizzle migrations); a column rename here silently broke the worker there,
  at run time, on the next cut.
- The global game-time mapping (ADR 0002) that turns a tag window into `(chapter, local offset)`
  pairs. This repo has it in `@/lib/time-mapping`, unit-tested, and `planClipCut`
  (`@/features/clips/boundary`) already produces the exact per-file cut plan the worker needs -
  its doc comment even says it exists to be "the app-side of the shared worker contract". The
  Python worker re-derived the same arithmetic, and only clamped at a chapter seam instead of
  cutting across it.
- The per-type clip windows in `@/lib/tag-types`. The worker had no view of them, so a tag with no
  explicit end fell back to a fixed 20s guess.

Deploying it also meant a second repository on the server (private, so a deploy key or a second
clone credential) for what is one `ffmpeg` invocation per clip.

## Decision

The clip cut worker lives in this repo, in TypeScript, and reuses this repo's schema, time mapping
and tag-type config:

- `src/features/clips/cut/` - the queue claim/report SQL, the ffmpeg command building and cutting,
  and the pure loop.
- `scripts/clip-worker.ts` - the composition root, run as `pnpm worker:clips`.
- A `worker` stage in the `Dockerfile` (the toolchain stage plus ffmpeg), deployed as its own
  Compose service next to the app.

It stays a **separate process**, never a route handler or a background task inside the web server:
a cut must not sit in a request, and a crashing cut must not take the app down with it. The queue
contract from ADR 0003 is unchanged - `clips` rows are still the queue, and a second consumer could
still claim from it, since claiming is `FOR UPDATE SKIP LOCKED`.

`hockey-video-pipeline` keeps the double-whistle detection, which is genuinely Python and genuinely
a batch job on the M4.

## Consequences

- One repo, one deploy, one migration owner for everything that touches the `clips` queue. A schema
  change and the worker that reads it move in the same PR and the same CI run.
- A clip whose window crosses a chapter seam is now cut per chapter and concatenated (P1-7,
  ADR 0004) rather than clamped at the seam, because `planClipCut` was already there to use.
- An open-ended tag is cut to its type's own follow-through instead of a fixed fallback.
- The worker image carries the app's toolchain and dev dependencies (it runs the TypeScript sources
  through `tsx`), so it is fatter than the standalone runtime image. Acceptable for one long-lived
  container on the VPS; bundling it to a slim runtime is a later optimization.
- The VPS now runs ffmpeg in a container of its own. ADR 0003's rule still holds and is unchanged:
  **copy-cuts only** on the VPS - no re-encoding, no analysis.
