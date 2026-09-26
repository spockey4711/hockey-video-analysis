# 0010 - Store tactics board scenes as versioned JSON in pitch metres

- **Status:** Accepted
- **Date:** 2026-09-25
- **Deciders:** Yannik
- **Supersedes:** none
- **Superseded by:** none

## Context

The tactics board lets a coach set up a scene on a field hockey pitch: two teams of player
tokens, a ball, and lines and arrows drawn over them. It ships in three slices. Slice 1 is the
board itself (place, move, draw, save). Slice 2 animates a scene from one arrangement to the next.
Slice 3 opens scenes in presentation mode and gathers prepared scenes, still or animated, into a
collection the way clips are. All three read and write the same scene, so its shape has to hold
up for work that is not built yet.

The constraints:

- The same scene is shown on a phone, a laptop and a projector, and on a phone the pitch is
  turned upright. A position in pixels would mean nothing on another screen.
- A scene is always loaded and saved whole: the board edits it in memory and saves it in one
  go. Nothing queries inside a scene (no "every scene where player 7 stands in the circle").
- Slice 2 will add frames or keyframes, and later slices may add more kinds of marks. The format
  will change, and scenes saved before a change must still open.
- The pitch has official dimensions. The FIH Rules of Hockey (effective 1 March 2026), "Field and
  Equipment Specifications", give every marking to the millimetre:
  <https://www.fih.hockey/static-assets/pdf/fih-Rules-of-hockey-2026-final.pdf>.

## Decision

We store each scene as one JSON document in a `jsonb` column of a `tactics_scenes` table, next to
its name and author. The table holds nothing else about the scene.

- **Coordinates are pitch metres.** `x` runs along the side-lines from the outer edge of the left
  back-line (0) to the right one (91.40); `y` runs along the back-lines from the top side-line (0)
  to the bottom one (55.00). The board reaches 3 m past the back-lines and 2 m past the side-lines
  (the FIH minimum run-off), so a player can stand behind the back-line at a penalty corner. The
  pitch is drawn from the FIH numbers in one module (`src/features/tactics/pitch.ts`), and the
  board is an SVG whose user units are these metres, so the drawing, the stored scene and every
  screen size agree. Turning the pitch upright on a phone is a view transform only.
- **The document carries its own `version`.** Version 1 is
  `{ version, tokens: [...], lines: [...] }`: player tokens (team, a label of up to four
  characters, an optional roster player id, position), at most one ball, and lines (a plain line,
  a straight arrow, or a curved arrow stored as the start, control point and end of a quadratic
  Bezier) in the telestration pens, widths and solid or dotted style.
- **One parser owns the format.** `parseScene` in `src/features/tactics/scene.ts` validates every
  scene the server receives and every scene it reads back, rejecting the whole document on the
  first bad value. A new version adds its shape and an upgrade step from the previous version
  there; nothing else reads the raw JSON.
- **Roster links are ids, labels stay free text.** A token may point at a player by id; the label
  is what the board shows. A deleted player leaves a dangling id that the board ignores, never
  personal data in the scene.

Alternatives considered:

- **Normalised tables** (tokens, lines, later frames as rows). They would let the database check
  each field, but every save would rewrite many rows, every format change would need a migration,
  and no query needs to look inside a scene.
- **Normalised 0..1 coordinates**, as telestration uses for a video picture. The pitch is a known
  physical size, so metres are just as screen-independent, and they keep distances meaningful
  (a nudge of 0.5 m, a pass of 20 m) for the animation slice.

## Consequences

- Saving is one small write, and a format change needs code, not a migration.
- The database cannot check a scene's shape; `parseScene` is the only guard, so it is tested
  field by field and runs on both write and read. A stored scene that no longer parses is treated
  as missing rather than drawn half-broken.
- Slice 2 adds its frames under a new `version` with an upgrade from version 1. Slice 3 puts
  scenes into a collection by id, through the `collection_scenes` table, without touching the
  scene document ([ADR 0014](0014-tactics-scenes-as-collection-entries.md)).
- Revisit this if a feature needs to query inside scenes, or if scenes grow large enough that
  saving them whole becomes slow.

## Amendment (2026-09-26): the short-corner view

A coach setting up a penalty corner only needs the area around one goal, and on the whole board
that area is a small corner of the screen. A scene can therefore show a quarter of the pitch
instead of all of it.

- **The view is part of the scene.** Version 3 of the document adds
  `view: "full" | "corner-left" | "corner-right"`. `parseScene` upgrades a version 2 scene (and
  through it a version 1 scene) to version 3 with `view: "full"`, so every stored scene opens as
  before and nothing is migrated. The editor, the board over presentation mode and a scene in a
  collection or on its share link all read the view from the scene.
- **The quarter comes from the FIH numbers.** A short-corner view is one quarter of the field:
  the whole width between the side-lines plus their 2 m run-off (for the side marks), and along
  the side-lines from the 3 m run-off behind the back-line to 1 m past the 23 m line, that is
  `x` from -3 to 23.90 at the left goal and from 67.50 to 94.40 at the right one (`viewBounds`
  in `pitch.ts`). That holds the goal, the injection marks on the back-line, the circle, the 5 m
  broken line, the penalty spot and the 23 m line with a strip of turf past it, so the line does
  not read as the edge of the picture.
- **It is only a view.** Positions stay pitch metres, so switching the view never moves a token
  or a line. A token or line wholly outside the quarter is not drawn (and so cannot take keyboard
  focus); anything reaching in is clipped at the edge, and all of it is back on the whole pitch.
  While a quarter is on show, drags, nudges, bends and new tokens stay inside it.
- **The quarter lies the other way round.** The quarter is tall and narrow (26.9 by 59 m), so a
  landscape screen and the landscape stage of a collection show it turned a quarter, its goal at
  the top, and a phone held upright shows it as it is. This is a view transform only, like the
  upright pitch on a phone.

Other partial views (a half pitch) fit the same field as further values, each with its bounds in
`viewBounds`.
