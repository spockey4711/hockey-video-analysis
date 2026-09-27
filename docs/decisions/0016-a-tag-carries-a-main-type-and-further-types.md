# 0016 - A tag carries a main type and further types; one moment stays one clip

- **Status:** Proposed
- **Date:** 2026-09-27
- **Deciders:** Yannik
- **Supersedes:** none
- **Superseded by:** none

## Context

A tag is a moment on the global game timeline (ADR [0002](0002-global-game-time-offset-model.md))
with one type from the configurable set (Tor, Ecke kurz, Aktion gut, Aktion schlecht), and the
clip worker cuts one clip per tag (ADR [0007](0007-clip-worker-lives-in-the-app-repo.md)).

Moments in hockey often are more than one thing: a short corner that ends in a goal, a good
action that is also a goal. Today the coach can only say that with two tags. Tagging a short
corner at 1:00 (`E`) that is scored at 1:04 (`T`) stores two tags, 0:52-1:06 and 0:54-1:09, so
the worker cuts two clips of almost the same footage, the game report counts two moments, and a
collection or share link shows the same scene twice.

The constraints:

- **Existing data and links keep working.** Every stored tag has exactly one type, many have a
  cut clip that sits in collections, carries comments and edits (ADR
  [0011](0011-clip-edits-are-data-rendered-at-playback.md)) and is on share links.
- **Migrations are expand-then-contract** (`docs/ops/deployment.md`): the running app, a rollback
  and Mac builds already in use read and write `tags.type`.
- **The Mac app syncs tags field by field** with row versions kept by triggers (ADR
  [0013](0013-native-mac-app-is-the-coachs-editing-desk.md)): a migration that rewrites every
  tag bumps every tag's version and every game's revision, so each Mac would see every tag as
  changed.
- **The type still drives capture.** A hotkey captures one type, and that type's window (the
  team's Tag-Fenster or the default) sets the clip window. A tag without a stored end is cut to
  its type's default window.

## Decision

**A tag keeps its main type and may carry further types. It stays one moment and one clip.**

- **`tags.type` stays the main type:** the type the moment was captured as. It sets the capture
  window and the default end, and it is the colour of the tag's marker and its first chip.
- **`tags.extra_types` (`text[]`, not null, default empty) holds the further types** the same
  moment also counts as. The keys are configured tag types, never the main type, never twice,
  stored in the order of the tag-type config. A check constraint keeps the main type and nulls
  out of the list; `src/lib/tag-types/types.ts` validates and orders it (`parseExtraTypes`,
  `normalizeExtraTypes`) for every write path.
- **A tag's types are its main type followed by its further types** (`tagTypeKeys`). Every
  question of the form "is this a goal" asks the whole set - a report count, a filter, a
  playlist - never the main type alone.
- **Capture is unchanged.** A hotkey still captures a new tag of its type. The coach adds or
  removes further types on the tag: "Bearbeiten" in the tag's detail shows every type as a
  toggle, the main type first. Switching off the main type makes the first further type the
  main type. There is no automatic merge of captures that overlap, since it would change what a
  key press does.
- **Types do not re-cut.** Adding or removing a further type leaves the clip window, so the clip,
  its collections, comments, edits and share links stay as they are. A main-type change re-cuts
  only while the end is the default (the existing rule in `tagging/edit/recut.ts`).
- **The API is additive.** Tag payloads carry `extraTypes` (always present, possibly empty) next
  to `type`. `POST /api/tags` takes an optional `extraTypes`; `PATCH /api/tags/[id]` takes it
  too, and without it keeps the stored further types (minus a new main type), so a Mac build
  that does not know the field never drops them.

### Migration

One additive step: `ALTER TABLE tags ADD COLUMN extra_types text[] DEFAULT '{}' NOT NULL` plus
the check. A column with a constant default is a catalogue change in Postgres 11 and newer: no
row is rewritten, no trigger fires, so no sync version moves. Every existing tag reads as a
single-type tag with no further types, and its clip and share links are untouched. The running
app and a rollback ignore the column; a rollback that sets a main type which is also a further
type is refused by the check rather than storing it twice.

### Alternatives considered

- **Replace `type` with a `types` array.** One list and no main type, but the backfill rewrites
  every tag (and with it every sync version and game revision), dropping `type` breaks the
  running app, a rollback and the Mac, and every consumer must change in the same deploy. The
  capture window and default end would still need a main type, first in the array.
- **A `tag_types` join table.** The same migration story, plus a join or aggregate in every read
  for a handful of fixed keys, where `tag_players` earns its table by pointing at rows.
- **Group separate tags into one moment.** Keeps one type per tag but leaves one clip per tag,
  so the same footage is still cut, counted and shared twice.

## Consequences

- One tag, one clip, several types: a short corner that ends in a goal is one clip that shows up
  as a goal and as a short corner.
- Every reader of a tag's type must use the whole set. A reader that still reads only `type`
  degrades gracefully - it shows and counts the moment under its main type, as before this ADR -
  so the readers move over slice by slice. This PR moves the model, the tag API and the coach's
  tagging workspace; the game report and CSV, the share and collection views, the clip picker and
  executions filters, and the Mac app (M3 local tagging, S3 sync) follow.
- The main type stays a concept: it chooses the capture window and the marker colour. Coaches
  see it only as the first chip.
- Revisit if coaches want captures that overlap to merge on their own, or a hotkey that adds a
  type to the selected tag instead of capturing a new one.
