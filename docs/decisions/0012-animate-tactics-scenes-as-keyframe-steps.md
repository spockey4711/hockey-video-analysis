# 0012 - Animate tactics scenes as keyframe steps in the scene document

- **Status:** Proposed
- **Date:** 2026-09-25
- **Deciders:** Yannik
- **Supersedes:** none
- **Superseded by:** none

## Context

Slice 2 of the tactics board animates a scene: players and the ball move from one arrangement to
the next while the coach explains the move. [ADR 0010](0010-tactics-scenes-as-versioned-json-in-pitch-metres.md)
stores a scene as one versioned JSON document in pitch metres and expected slice 2 to add its
frames under a new version. Three things have to hold:

- A coach builds an animation the way they explain one: "first 9 runs into the gap, then the ball
  goes to 10". Positions are set by dragging, not by typing times.
- Slice 3 plays scenes in presentation mode, and a future Mac app may play them too. Both must
  draw the same frames as the editor from the stored document alone.
- Scenes saved by slice 1 must still open, and the document must stay small (it is saved whole).

## Decision

We animate a scene as a list of **steps** (keyframes) in the scene document, now at `version: 2`:

```
{ version: 2, tokens: [...], lines: [..., step], steps: [{ duration, moves: [...] }] }
```

- **Step 0 is the start arrangement**: the tokens' own positions. Steps 1 to n follow in playing
  order, at most 20.
- **A step lists only what moves.** Each move is `{ token, x, y, via }`: where the token runs to in
  pitch metres, and either `null` (a straight run) or `via`, the on-board point the run passes
  halfway. A token not listed stays where the step before left it, so moving a start position
  carries into every later step that does not move that token.
- **A step has one duration**, 0.5 to 10 seconds, for all of its runs. Steps play back to back with
  no hold; each run eases in and out.
- **A line belongs to a step.** `step: 0` shows it throughout; `step: k` shows it while step `k`
  runs and while the board rests on it, so a pass arrow appears with its pass and gives way to the
  next step's drawings.
- **The engine is pure.** `src/features/tactics/animation.ts` maps a scene and a time in seconds to
  a frame (every token's position and the lines on show) with no React or DOM, so the editor,
  presentation mode and any other player draw identical frames. A bent run is the quadratic Bezier
  through `via` at its middle.
- **Older scenes upgrade on read.** `parseScene` turns a version 1 document into version 2 (every
  line on step 0, no steps) before validating it, so no migration touches the table.

Alternatives considered:

- **A full snapshot of every token per step.** Simpler to interpolate, but a scene of 40 tokens and
  20 steps would store 800 positions, adding a token would touch every step, and a start position
  would no longer carry into later steps.
- **A timeline of per-token keyframes at arbitrary times.** More expressive (overlapping runs of
  different lengths), but it asks the coach to think in seconds rather than in moves, and needs a
  timeline editor far beyond what a board needs.
- **Freehand drawn paths.** A run bent through one handle covers the curved runs and passes a
  coach draws; arbitrary paths would need path simplification and a much larger document.

## Consequences

- A still scene is simply a scene without steps; the editor, the format and slice 3 treat both
  alike.
- All runs within a step share its duration. A move that needs a different speed goes into its own
  step, which keeps the model simple but may take more steps for complex set pieces.
- The document grows with the steps; its accepted length rises from 50,000 to 100,000 characters,
  still far below what a single save handles comfortably.
- Revisit this if coaches need runs of different speeds within one step or a ball that follows a
  player automatically.
- Holds between steps, the earlier third trigger, arrived with scene version 8 (ADR 0010,
  amendment of 2026-09-27): a step may hold still for up to 10 seconds after it arrives. The
  engine lays each hold into the timeline (`stepStartTimes`), so `frameAt` stays the one pure
  function every player draws from, and the step on show (with its caption) stays up through its
  hold. A paused moment in a hold rests on the step, and playing from rest on a step starts the
  next one at once.

## Amendment (2026-09-27): the animation as a video

Coaches send set plays to the team chat, and a still picture of one step does not show the
runs. "Als Video" turns a scene's whole animation into an MP4 in the browser.

- **One more player of the engine.** Each frame is `frameAt` at the frame's time, drawn by the
  picture's own path (`BoardImage`, then `paintBoard` onto a canvas), so the video shows exactly
  what the link and the picture show, captions included. The video adds a one-second rest on the
  start before step 1 and tops the last step's hold up to 1.5 seconds, so the first and last
  pictures read in a chat preview; the holds in between play as the scene sets them. A frame
  equal to the one before is not drawn again.
- **WebCodecs and a local MP4 writer.** The browser's `VideoEncoder` encodes H.264 (High, Main or
  Constrained Baseline at level 4.0, the first it supports) at 1280 pixels wide and 30 frames a
  second. `mp4.ts` packs the samples into one track with the movie box first, about 250 lines
  instead of a muxing dependency. A browser without an H.264 encoder says so in German before
  any work starts.
- **Private data stays out.** The video is drawn from the scene document alone, which never holds
  the coaching points, and shows names only while the coach's board does.

Alternatives considered: `MediaRecorder` over a canvas stream records in real time, so a scene
takes as long to export as it plays and dropped frames show as stutter, and several browsers
record only WebM. A GIF of the same animation is far larger, needs its own encoder, and chat apps
turn it back into a video, so it is left for later.
