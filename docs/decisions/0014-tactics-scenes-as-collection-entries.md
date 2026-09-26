# 0014 - Place tactics scenes in a collection as entries after a clip

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Yannik
- **Supersedes:** none
- **Superseded by:** none

## Context

Slice 3 of the tactics board lets a coach prepare scenes before a session, still or animated
([ADR 0010](0010-tactics-scenes-as-versioned-json-in-pitch-metres.md),
[ADR 0012](0012-animate-tactics-scenes-as-keyframe-steps.md)), and play them for the team the way
clips are played: as entries of a collection, on its share link and in presentation mode. The
collection model ([ADR 0011](0011-clip-edits-are-data-rendered-at-playback.md)) already fixes a few
things:

- A collection is a set of clips (`collection_clips`) with no order column. Clips play
  chronologically, newest game first and then by game time, like on the team and player links.
- The share link is login-free and must not leak: it carries only display-ready data, and a
  scene's roster links point at real players, which only the coach's board uses.
- A scene is coach-only and has no share link of its own; the editor saves it whole, and it can
  change or be deleted after it was placed in a collection.

## Decision

A scene is placed in a collection as a row of a new `collection_scenes` table, next to the clip
rows and not in place of them.

- **An entry follows a clip.** It stores the clip it comes right after (`after_clip_id`, null for
  before the first clip) and its `position` among the scenes at that spot. Clips keep their
  chronological order; the coach moves a scene up or down past a clip or another scene, and the
  server rewrites every scene's placement from the new order in one transaction.
- **The placement is compared by play order.** A scene is merged in after every clip that comes at
  or before the clip it follows, by that clip's game date and game time. So it keeps its spot when
  the clip leaves the collection or is being re-cut; a deleted clip sets the reference to null and
  the scene moves to the start.
- **A still scene holds for a set time.** An entry carries `hold_s` (3 to 60 seconds, default 8),
  how long a scene without steps stays up before it counts as played. An animated scene plays
  through its steps on the pure engine of ADR 0012 and ends when they do.
- **The scene is read live, by reference.** An entry points at the scene; edits on the board show
  on the link at once, and deleting the scene removes the entry. A scene is in a collection at
  most once, and deleting the collection removes its entries.
- **The link gets only what drawing the scene needs.** Each entry reaches the link as its entry
  id, the scene's name, a subtitle (still, or the animation's length), the hold time and the
  scene document with every token's roster link removed. The scene's own id, its author and its
  timestamps never leave the server; the share token rules stay those of the clips.
- **The players treat a scene as an entry.** The collection link and presentation mode play it on
  a read-only scene stage in the clip's place, with the same transport: play, pause, end, replay
  and next. A scene counts no views and has no comments or drawing.

Alternatives considered:

- **An explicit order for every entry**, clips included. It would let the coach reorder clips too,
  but it changes the clip order every collection link has had, needs a migration of every
  collection and a way to place newly added clips; the clips' chronological order is kept.
- **A scene entry placed by index** ("after the third entry"). Adding or removing a clip would
  silently move every scene after it.
- **A snapshot of the scene in the entry.** It would freeze a prepared version, but a coach who
  fixes a scene on the board expects the collection to show the fix, and snapshots would double
  the storage of every scene.

## Consequences

- Clips and scenes share one play order that the coach arranges on the collection page, while
  clips keep playing chronologically among themselves.
- The share players accept a clip or a scene per entry; anything that walks the entries (preload,
  view counting, comments, markers) has to skip scenes, and does.
- A change to a scene reaches every collection that holds it at once, for better and for worse.
- The link carries a full scene document for each scene entry, a few KB each; `parseScene` still
  guards every scene read back, and an entry whose scene no longer parses is left out.
- Revisit this if coaches want to reorder clips themselves, or to keep a frozen version of a scene
  in one collection while editing it for another.
