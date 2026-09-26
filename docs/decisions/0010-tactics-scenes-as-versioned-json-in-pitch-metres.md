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

## Amendment (2026-09-26): the view is chosen once, and there is one short corner

Coaches set a scene up for one purpose: a penalty corner routine or play on the whole field. A
view switch on an existing scene only invited moving a scene half out of sight, and the choice
between the left and the right goal added nothing, since the pitch is the same turned end to end.

- **Two views.** Version 4 of the document has `view: "full" | "corner"`. The short corner is the
  quarter at the left goal, `x` from -3 to 23.90, laid across a landscape screen with its goal
  at the top, as `corner-left` was.
- **Chosen at creation, fixed after.** The create form offers "Ganzes Feld" (the default) and
  "Kurze Ecke"; the editor names the view but has no control to change it. The save action is
  the only writer, and it refuses a document whose view differs from the stored one: it reads
  the stored row `FOR UPDATE` in the save's transaction and compares the parsed views. A full
  scene starts with the default lineup, a short corner with only the ball in the quarter.
- **Upgrade, not migration.** `parseScene` upgrades version 3 on read: `full` stays,
  `corner-left` becomes `corner` unchanged, and `corner-right` becomes `corner` with every
  position (tokens, line points and curve controls, step targets and bends) turned half round
  the centre spot, `(x, y) -> (91.40 - x, 55.00 - y)`. The pitch and the board bounds are
  symmetric under that turn, so the play stands in the same place relative to every marking and
  looks exactly as before on a landscape screen. Stored rows keep their version 3 JSON until the
  next save writes version 4, so no SQL migration is needed.

## Amendment (2026-09-26): tokens near to scale in the short corner

At a penalty corner the keeper and four defenders stand in the 3.66 m goal mouth and run out. At
the whole pitch's token size (a 1.2 m radius) five of them cannot stand there without covering
each other.

- **Sizes are per view, not part of the document.** `boardSizes(view)` in `token-size.ts` holds
  what the board draws in metres. The whole pitch keeps its sizes. The short corner draws a
  quarter of them: a 0.3 m player disc (the ball in proportion), so five fit side by side in
  the goal with about 8 cm between them and the posts, and the selection ring, a run's trail and bend handle
  and the line pen shrink with them (the pen by half, as the quarter shows about twice as
  large). Only the drawing changes: positions stay pitch metres and the scene format does not.
- **Labels stay readable.** On screen a short-corner disc is only 7 to 12 px, too small for its
  label. A label there is drawn at least 9 CSS px high (the board measures its scale with a
  `ResizeObserver`) and, where that is larger than the disc, on a halo of the disc's colour.
  Tokens packed closer than a label is wide let their labels overlap; readability wins over
  keeping them apart.
- **Touch still works.** A token's hit circle stays larger than its disc (0.9 m in the short
  corner) and a pointer grabs the nearest token whose hit circle it lands in, so a finger picks
  the defender it is on even where the circles of neighbours overlap.

## Amendment (2026-09-26): formations a new scene starts from

Coaches set the same arrangements up again and again: the team's own defence on the whole field,
or its penalty corner routine. A formation keeps such an arrangement under a name so a new scene
can start from it instead of the fixed 1-3-4-3.

- **Its own table and document.** A `tactics_formations` row holds the name, whether the coach's
  team attacks or defends (`formation_kind`: `attack` or `defence`) and one JSON document
  `{ version: 1, view, tokens }`: a scene's view and start tokens without lines or steps.
  `parseFormation` in `src/features/tactics/formation.ts` validates it through `parseScene`, so a
  formation holds exactly what a scene's start arrangement may hold, in the same pitch metres. A
  formation stands for positions, not people: a token linked to a roster player is refused, and
  saving a scene as a formation drops the links. The players per team are counted from the
  tokens, not stored.
- **Made on the board.** A new formation opens on the scene board with only its placing tools
  (players, ball, undo); a scene's start arrangement can also be saved as a formation from its
  editor. The view is chosen at creation, like a scene's.
- **A scene starts from a copy.** The create-scene form offers the built-in starts of the chosen
  view and the coach's formations of that view. The scene gets a copy of the tokens and keeps no
  link, so editing or deleting a formation never changes a scene. The built-in starts are the
  1-3-4-3 lineup (the default) or an empty field on the whole pitch, and on the short corner only
  the ball (the default) or a standard penalty corner with the coach's team defending (keeper and
  four in the goal) or attacking.

## Amendment (2026-09-26): play lines

Coaches draw the same few moves on every board: a run, a pass, a dribble and a block. With only a
line, an arrow and a curved arrow in any style, "dotted means run" was a convention each coach
kept in their head and the players had to guess.

- **Play tools, not styles.** Version 5 of the document adds four `tool` values next to `line`,
  `arrow` and `curve`: `run` (a dotted arrow), `pass` (a solid arrow), `dribble` (a wavy arrow)
  and `block` (a line ending in a bar across it). The meaning fixes the look: a run is always
  `dotted` and the other three always `solid`, and `parseScene` rejects a play line in the other
  style. Colour and width stay free, as for every line.
- **Straight or bent.** A play line keeps two ends, or three points like a curve (start, control,
  end of a quadratic Bezier). The board keeps the drag straight unless it strays more than 8 % of
  the line's length from the straight line between its ends, so a wobbly pass stays straight and
  a run bowed round a defender bends. The drawing tools keep their shapes: a line and an arrow
  two ends, a curve three points.
- **Drawn from the telestration geometry.** A run and a pass are the telestration arrow in their
  style; the dribble's wave and the block's bar are sized from the same pen, in
  `src/features/tactics/line-paths.ts`, so every view draws them alike.
- **A legend where the scene is shown.** The board in the editor and over presentation mode lists
  under the pitch each play tool the scene uses, and a scene on a collection's stage (its link
  and presentation mode) and the board on the projector of the presenter view carry the same
  legend in a corner, sized with the picture. A scene without play lines shows none.
- **Upgrade, not migration.** `parseScene` upgrades version 4 on read by only raising the version:
  version 4 held only the drawing tools, which keep their look unchanged. Stored rows keep their
  JSON until the next save writes version 5. The audience window of the presenter view parses
  the board through the same parser, and its protocol version is raised so a window loaded before
  the change asks for a reload instead of dropping a play line.
