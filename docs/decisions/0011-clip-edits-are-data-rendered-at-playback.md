# 0011 - Clip edits are data, rendered at playback; the VPS stays copy-cut only

- **Status:** Accepted
- **Date:** 2026-09-25
- **Deciders:** Yannik
- **Supersedes:** none
- **Superseded by:** none

## Context

The clip editor lets a coach finish a clip for a collection: shorten it to the exact frame,
slow parts of it down, zoom in on a part of the picture, and draw markers (arrows, circles,
lines) that viewers can switch on and off. The result is shared as a normal collection link and
shown in presentation mode. It ships in five slices; this ADR fixes what every slice builds on.

The constraints:

- The VPS may only copy-cut clips (ADR [0003](0003-hardware-role-split.md),
  [0007](0007-clip-worker-lives-in-the-app-repo.md)); its one re-encode is the 720p tagging proxy
  (ADR [0008](0008-google-drive-holds-originals.md)). Baking a zoom, slow motion or a drawing into
  a file is a re-encode.
- A copy-cut starts at the keyframe at or before the requested start (ADR
  [0004](0004-copy-cut-clips-with-keyframe-tolerance.md)), so the clip file begins up to a keyframe
  interval before its tag. Until now the app assumed file time 0 is the tag start, which is fine
  for plain playback but wrong for anything placed at an exact moment.
- A marker burned into a video can never be hidden again, and a zoom baked into a re-encode loses
  quality that a zoom of the full-resolution picture on the viewer's screen keeps.
- The same scene may be edited for one collection and stay plain in another; the team and player
  links always show the plain clip.

## Decision

**Edits are stored as data and applied by the app's own player while the clip plays.** The clip
file on the server stays the full-resolution copy-cut it is today; no edit ever produces a new
file on the VPS.

- **An edit belongs to a collection entry.** It lives on the `collection_clips` row
  (`edit` jsonb, null = unedited), next to that entry's team and presenter notes. Removing the
  clip from the collection, deleting the collection or deleting the tag removes the edit through
  the existing cascades. A clip appears at most once per collection, and the play order stays
  chronological.
- **One versioned document, times in global game time** (ADR
  [0002](0002-global-game-time-offset-model.md)). Version 1 holds an optional trim (in and out
  point), non-overlapping slow-motion ranges (0.5x or 0.25x, muted), zoom keyframes (a crop in
  picture space 0..1, like telestration, whose height follows its width so the aspect ratio never
  changes, each either held or glided to the next), and markers (telestration strokes shown at a
  moment for a hold time, freezing the picture by default or running on). Game time keeps an edit
  on the same moment when the clip is re-cut into a new file.
- **One parser owns the format.** `parseClipEdit` in `src/features/clip-edits/` validates every
  edit the server receives and every edit it reads back, with hard caps (20 zoom keyframes,
  10 slow ranges, 30 markers, 2000 points per stroke, 128 KiB in total), because the document is
  shipped to login-free viewers. A write must also lie inside the clip's current window; a read
  is only checked for shape, so an edit survives a later window change and is clamped at playback
  instead. A later version adds its shape and an upgrade step there.
- **The worker records where a clip file really starts.** `clips.cut_start_s` is the game time
  at clip-file time 0. After each cut the worker asks ffprobe which keyframe the same seek lands
  on, and subtracts the video start time of the written file, so a player's `currentTime` maps to
  game time as `cut_start_s + currentTime`. Clips cut before this was recorded get the value from
  an idle-time, probe-only backfill that never re-cuts; a ready clip without it was always cut
  from its tag's current window, because a window edit sends the clip back to `pending`.
- **Players get a file-relative plan.** `toPlaybackPlan` turns an entry's edit and the clip's
  `cut_start_s` into clip-file seconds on the server, and `editStateAt` gives the playback rate,
  the zoom crop, the visible markers and whether the out-point has passed at a clip-file time.
  The client contract stays display-ready.
- **Saving uses optimistic concurrency.** `collection_clips.edit_version` counts saves; a save
  names the version it started from, and a stale one is refused (HTTP 409) instead of silently
  overwriting another tab's work.
- **Making a clip longer re-cuts it.** Footage outside the clip file needs a new copy-cut, so
  lengthening widens the tag window through the existing tag edit, and the longer clip then shows
  on every link. Shortening is an entry trim and stays per collection.

Alternatives considered:

- **Bake edits into new files on the VPS.** Rejected: it re-encodes, which ADR 0003 forbids, loses
  quality on a zoom, can never hide a marker, and makes the coach wait for every change.
- **Render a baked file on the M4.** Rejected for now: it depends on the Mac being awake and still
  cannot hide markers. An MP4 with the edits built in can later be rendered in the coach's own
  browser from the same plan, without server CPU.
- **Edits on the clip itself.** Rejected: an edit would change the team and player links for
  everyone and rule out two versions of one scene in different collections.
- **Edit times in clip-file seconds.** Rejected: a re-cut starts the file at another keyframe, and
  file-time edits would shift onto the wrong frames.

## Consequences

- An edit costs a few KB of JSON and no server CPU, and plays as soon as it is saved. Trims and
  slow-motion switches land within about a frame where the browser has
  `requestVideoFrameCallback`.
- The collection link and presentation mode need the app's own controls for edited clips: the
  browser's native controls cannot hold a trim window, their speed menu would override slow
  motion, and their fullscreen shows the bare video without zoom or markers. iPhone Safari has no
  element fullscreen, so edited clips use an in-page fullscreen there.
- Anyone who downloads or forwards the clip file gets it without the edits. An MP4 with the edits
  built in is an optional, later in-browser export.
- The database cannot check an edit's shape; `parseClipEdit` is the only guard, so it is tested
  field by field and runs on both write and read. A stored edit that no longer parses is treated
  as no edit.
- Everything placed at a moment depends on `cut_start_s`. A clip whose value is not known yet
  plays with the old assumption (file time 0 = tag start) until the backfill reaches it.
- Revisit this if viewers mostly need edited files outside the app, or if the in-browser players
  cannot keep frame-accurate timing on the devices players use.
