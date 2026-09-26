# 0015 - Present on a second screen with two windows over a broadcast channel

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Yannik
- **Supersedes:** none
- **Superseded by:** none

## Context

The team session runs the collection's presentation mode on a projector or TV. With one window,
whatever the laptop shows, the room sees: the coach's private presenter notes stay safe only
while the notes panel is off, and the coach has to remember to press `h` before sharing the
screen. With the projector as an extended second screen, the usual answer is a presenter view,
as in Keynote or PowerPoint: the room sees the slides, the laptop sees the notes, the next slide
and a clock.

The constraints:

- The presentation runs on the login-free share links. The coach's notes reach the page only for
  a signed-in coach session, and the room must never receive them - not hidden, not in the page.
- A browser page cannot draw into a second screen on its own. It can open a second window; with
  the Window Management API (`getScreenDetails`, Chrome) and the viewer's permission it can open
  it across another screen, and otherwise the coach drags it over.
- The presentation already has clips with edits (in and out point, slow motion, zoom, markers
  that hold the picture), tactics scene entries, title cards, drawing, the laser pointer and the
  tactics board. The room must see all of it as it happens.
- The native Mac app plans the same split (M12) and needs a model of what the audience window
  may receive.

## Decision

We present on a second screen with two windows of one browser that talk over a
`BroadcastChannel`. The presenter window drives; the audience window only shows.

- **The audience window loads no data.** It is `/share/present#<session>`, login-free and
  `noindex`, and renders only what the presenter sends. The session id rides in the fragment,
  which never reaches the server, and names the channel (`hva-presentation:<session>`). The
  window has a fixed name, so opening it again (also after the presenter reloaded) reuses the
  window already on the projector.
- **The protocol has no field for anything private.** The messages below carry the picture and
  what is drawn over it. Notes, the coach's scene list, the view-counting share token, clip
  comments and subtitles have no field, and the builders copy each field by name instead of
  spreading the presenter's data, so a field added to a playlist entry later stays on the laptop.
  A scene's roster links are dropped as on the share link (ADR 0014).
- **A resync is a `hello`.** The audience says `hello` when it loads, and the presenter answers
  with the whole session; a reload says `bye` and `hello` again. The presenter says `end` when the
  presentation closes and when its window goes (`pagehide`); the audience then shows a neutral
  "Präsentation beendet".
- **The audience plays along on its own clock.** Both windows play the same file; the audience is
  muted and follows play, pause and the frame, and seeks only when it drifts more than 0.35 s.
  A marker's hold on the presenter is mirrored as a still picture, and a paused picture is sent
  as the frame on screen (`requestVideoFrameCallback`), since the element's clock can lag it.
- **Nothing is stored.** Which window is which lives in the two windows; there is no database
  row, no setting and no server round trip.

Messages carry `v` (the protocol version, now `1`) and `type`. A window that hears another
version asks for a reload of both windows.

| Direction           | `type`    | Payload                                                             |
| ------------------- | --------- | ------------------------------------------------------------------- |
| presenter->audience | `session` | `entries`, `state`: everything, answering `hello`                   |
| presenter->audience | `state`   | `state`, on every change and once a second as the clock             |
| presenter->audience | `pointer` | `at`: the laser dot on the picture (0 to 1 both ways), or `null`    |
| presenter->audience | `end`     | none: the presentation closed or the presenter window went          |
| audience->presenter | `hello`   | none: loaded or reloaded, send everything                           |
| audience->presenter | `bye`     | none: closing or reloading                                          |
| audience->presenter | `command` | `command`: `next`, `previous` or `toggle-play` from the window keys |

An entry is a clip (`kind: "clip"`, `id`, `src`, `title`, optional `plan` and `frameRate`) or a
scene (`kind: "scene"`, `id`, `title`, `scene`, `holdS`). The state is `index`, `card` (the title
card up, or `null`), `showMarks`, `drawing` (the strokes in picture space, or `null`), `pointer`
(whether the laser is on), `board` (`scene`, `step`, `playback`, `draft`, or `null`) and `media`
(`playing`, `held`, `time` on the file's clock or `null` for a scene, `rate`, and `at`, the
epoch milliseconds `time` was read). The source of truth is
`src/features/share/presentation/audience-protocol.ts`, with a parser for each direction.

Alternatives we did not take:

- **The audience window loads the share page in an audience mode.** It would fetch the page
  again, and for a signed-in coach the server would render the notes into it; keeping them out
  would rest on a flag rather than on what the window can receive.
- **One window renders into the other (`window.open` plus a React portal).** The audience DOM
  would live in the presenter's JavaScript, with the notes in the same heap, and a reload of the
  projector window would lose it.
- **A server relay (WebSocket).** Both windows are on one laptop; a server hop adds a moving part,
  latency and a failure without Wi-Fi, for nothing the channel does not already do.

## Consequences

- The notes never reach the projector window, by construction, and the "press `h` before you
  share" risk is gone when presenting on a second screen. One window works as before.
- Both windows decode the video; on a club laptop that is two decodes of one clip. The audience
  is muted to avoid a second soundtrack.
- The audience's scene clock runs on its own (a scene has no seek); a reloaded window restarts a
  playing scene from its start. Scenes are seconds long, so we accept it.
- Placing the window on the projector needs Chrome and the viewer's permission; elsewhere the
  coach drags it over and presses "Vollbild".
- Any new presentation feature that the room should see needs a field here, a parser case, a
  version bump if old windows would misread it, and the same field in the Mac app.
