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
| `vectors/quarters.json`        | Quarter validation, navigation, bands, break skip, quarter clock           | `src/features/quarters/`                             |
| `vectors/cut-plan.json`        | A clip's end and its per-chapter cut plan (ADR 0004)                       | `src/features/clips/`                                |
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
3. Commit the JSON with the rule change. Once the Mac app exists, its port changes in the same
   PR, or its tests fail.

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
  "constants": { "maxQuarters": 4 },
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
- **Defaults are inputs.** The tag windows in `tag-types.json` and the 15-minute quarter may
  become team or game settings, so the capture and quarter-clock vectors pass the window and the
  quarter length explicitly. A port takes them as arguments too and never hard-codes the
  defaults inside the rule.
- Error texts are not pinned. Where the reference returns a failure with a message (quarters,
  game parts), the vector keeps only the outcome, because each app words its own messages.
- JSON has no `NaN` or infinity, so the guards against non-finite numbers are tested in each
  language's own unit tests, not here.

## Public repo

This folder is public like the rest of the repo. Cases use made-up folder names (`Game A/`) and
synthetic durations: never real footage, player names, share tokens or local machine paths.
