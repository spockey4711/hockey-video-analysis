# Shared contracts

The rules and data that more than one implementation must agree on: the web app's TypeScript and
the native Mac app's Swift port ([ADR 0013](../docs/decisions/0013-native-mac-app-is-the-coachs-editing-desk.md)).
The TypeScript in `src/` is the reference. Everything here is generated from it, so both apps are
tested against the same answers.

| Path                           | What it holds                                                              | Reference                                            |
| ------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------- |
| `tag-types.json`               | The tag types: key, German label, hotkey, colour tone, default clip window | `src/lib/tag-types/config.ts`                        |
| `pitch.json`                   | The FIH pitch in metres, plus the derived board, goals and markings        | `src/features/tactics/pitch.ts`                      |
| `vectors/time-mapping.json`    | Game time to (chapter, local offset) and back (ADR 0002)                   | `src/lib/time-mapping/game-time-map.ts`              |
| `vectors/source-segments.json` | A game-time window split across chapter seams                              | `src/lib/time-mapping/boundaries/source-segments.ts` |
| `vectors/source-breaks.json`   | GoPro recording ids and recording breaks on the timeline                   | `src/features/player/source-breaks.ts`               |
| `vectors/tag-capture.json`     | Hotkey to tag type, capture point to clip window                           | `src/features/tagging/capture.ts`                    |
| `vectors/game-parts.json`      | Which files of a game folder are the game, in which order                  | `src/features/ingest/parts.ts`                       |
| `vectors/game-format.json`     | A game's period count and length, from its own columns or the team default | `src/features/game-format/format.ts`                 |
| `vectors/quarters.json`        | Quarter validation, navigation, bands, break skip, quarter clock           | `src/features/quarters/`                             |
| `vectors/cut-plan.json`        | A clip's end and its per-chapter cut plan (ADR 0004)                       | `src/features/clips/`                                |
| `vectors/playback-rate.json`   | The playback rates, cycling and stepping them, and their German label      | `src/features/player/playback-rate.ts`               |
| `vectors/game-clock.json`      | A game time as the clock shows it, `M:SS` or `H:MM:SS`                     | `src/features/player/format-timecode.ts`             |
| `vectors/tag-edit.json`        | A tag's window nudged and checked, and whether an edit re-cuts its clip    | `src/features/tagging/edit/`                         |
| `vectors/tag-validation.json`  | Which new tags and tag edits may be stored                                 | `src/features/tagging/`                              |
| `vectors/jump-markers.json`    | Next, previous and current marker from the play position                   | `src/features/player/jump-markers/navigation.ts`     |
| `vectors/quarter-draft.json`   | The quarter editor's rows: the set they save and what blocks saving        | `src/features/quarters/draft.ts`                     |
| `generator/`                   | The TypeScript that writes all of the above                                | -                                                    |

Later slices add `schemas/` (the versioned clip edit and tactics scene documents) and `api/` (golden
app API payloads); the [Mac app plan](../docs/project/mac-app-plan.md) says which slice adds what.

## Commands

```bash
pnpm contracts:generate   # rewrite every generated file from the TypeScript
pnpm contracts:check      # fail if a committed file no longer matches (CI runs this)
```

`pnpm test` runs the same check, so the usual quality gate catches a stale file too.

## Changing a rule

1. Change the TypeScript rule and its unit tests as usual.
2. Run `pnpm contracts:generate` and review the diff of the JSON: it shows exactly which answers
   changed.
3. Commit the JSON with the rule change. The Swift port in `mac/HockeyKit` changes in the same
   PR, or its tests fail: they read these files directly (`swift test`, see
   [`mac/README.md`](../mac/README.md)).

Never edit a generated file by hand. To pin a new case, add it to the matching file in
`generator/`. To pin a new rule, add a builder there and list it in `generator/index.ts`.

## Vector files

Every file in `vectors/` has the same shape:

```json
{
  "contract": "time-mapping",
  "description": "What the rule does, in one paragraph",
  "reference": ["src/lib/time-mapping/game-time-map.ts"],
  "tolerance": 1e-9,
  "constants": { "defaultPeriodCount": 4 },
  "cases": [
    {
      "name": "the first seam starts chapter 1",
      "call": "toSourcePoint",
      "input": {
        "durationsS": [10.026667, 10.010604, 5.5],
        "gameTimeS": 10.026667
      },
      "returns": { "sourceIndex": 1, "localOffsetS": 0 }
    },
    {
      "name": "rejects a negative time",
      "call": "toSourcePoint",
      "input": {
        "durationsS": [10.026667, 10.010604, 5.5],
        "gameTimeS": -0.02
      },
      "throws": true
    }
  ]
}
```

How a port reads them:

- **`call`** names the reference function; **`input`** holds its arguments by parameter name.
- **`returns`** is the expected value (`null` for no value). **`throws: true`** means the reference
  rejects the input; the port must reject it too, in its own way (a thrown error, a `nil`, a
  failure result). A case has exactly one of the two.
- **Numbers** compare within the file's absolute **`tolerance`**. Integers, strings, booleans,
  `null` and the shape of objects and lists compare exactly. The tolerance is far below a video
  frame and a millimetre, and covers only last-bit differences between math libraries; a port that
  sums chapter durations in chapter order gets the same seams bit for bit.
- **`constants`** are the limits the rule uses, so a port can assert its own copies. A constant
  named `default...` is a default, not a law.
- **Defaults are inputs.** The tag windows in `tag-types.json` are defaults a team may replace
  per type (see [Tag windows](#tag-windows)), and the game format (4 x 15 by default) is a team
  default with an optional format per game (`game-format.json`). So the capture vectors pass the window, the quarter clock the period
  length and the quarter validation the period count explicitly. A port takes them as arguments
  too, resolves the game's format the same way, and never hard-codes the defaults inside the
  rule.
- Error texts are not pinned. Where the reference returns a failure with a message (quarters,
  game parts), the vector keeps only the outcome, because each app words its own messages.
- JSON has no `NaN` or infinity, so the guards against non-finite numbers are tested in each
  language's own unit tests, not here.

## Tag windows

A team may set its own clip window per tag type (Einstellungen > Tag-Fenster, stored in
`tag_type_windows`); the window in `tag-types.json` is the type's default and what "Zurücksetzen"
returns to. A window is whole seconds, `preS` from 0 to 60 and `postS` from 1 to 60. It only
shapes new captures: a tag stores its own start and end, so a changed window never moves one. A
tag without a stored end is cut to `start + postS` of the same effective window.

`GET /api/tag-windows` (coach session; `401` without one, `Cache-Control: no-store`) answers
every configured type in display order with the window a new capture of it gets, so a client
needs no merge rule of its own. `isDefault` says whether the team left the type on its default.

```json
{
  "windows": [
    { "type": "goal", "preS": 15, "postS": 5, "isDefault": false },
    { "type": "corner_short", "preS": 8, "postS": 6, "isDefault": true },
    { "type": "action_good", "preS": 8, "postS": 4, "isDefault": true },
    { "type": "action_bad", "preS": 8, "postS": 4, "isDefault": true }
  ]
}
```

A client that captures offline keeps the last answer and uses the defaults from
`tag-types.json` until it has one. A type the answer does not list captures with its default.

## Public repo

This folder is public like the rest of the repo. Cases use made-up folder names (`Game A/`) and
synthetic durations: never real footage, player names, share tokens or local machine paths.
