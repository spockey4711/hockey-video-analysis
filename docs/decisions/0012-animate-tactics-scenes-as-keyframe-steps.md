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
- Revisit this if coaches need runs of different speeds within one step, holds between steps, or a
  ball that follows a player automatically.
