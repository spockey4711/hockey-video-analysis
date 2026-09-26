# Hockey Video for the Mac

The coach's editing desk as a native SwiftUI app ([ADR 0013](../docs/decisions/0013-native-mac-app-is-the-coachs-editing-desk.md)):
games straight from the camera card or the SSD, at full quality and without network traffic.
The [Mac app plan](../docs/project/mac-app-plan.md) lists the slices. This folder holds
`HockeyKit`, the Swift package with all of the app's logic; the app target that plays a game
folder follows in the next part of slice M1.

## Layout

| Path                             | What it holds                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| `HockeyKit/`                     | A Swift package with all logic, fully unit-tested                                    |
| `HockeyKit/Sources/HockeyCore/`  | Pure rules ported from the web's TypeScript, pinned by [`contracts/`](../contracts/) |
| `HockeyKit/Sources/HockeyMedia/` | AVFoundation: reading a game folder, the game's composition, the player              |

Rules live in `HockeyKit`, never in a view. A rule the web app also has is a port: its golden
vectors come first (`contracts/README.md`), and its Swift tests read them.

## Requirements

macOS 26 and Xcode 26 (Swift 6.2 or newer). Nothing else: no package dependencies yet.

## Test

```bash
cd mac/HockeyKit
swift test -Xswiftc -warnings-as-errors
```

The rule tests read `contracts/vectors/*.json` from this checkout, so a rule changed in the
TypeScript fails here until the port follows. The media tests write short synthetic chapters into
a temporary folder; no footage is ever committed.

## What HockeyKit does with a game folder

- **Chapters:** the shared part rules (`selectGameParts`) pick and order the game's files: GoPro
  chapters by recording, then chapter, or exported halves or quarters. A camera card works too:
  when the picked folder holds no parts, it looks in the card's `DCIM` folders.
- **Durations:** each chapter's length is the largest stream end over its tracks, rounded to
  microseconds like ffprobe's `format.duration`, the value `game_sources.duration_s` stores.
- **One timeline:** one composition places chapter `i` at the sum of the durations before it, so
  a game time is the same frame here and on the web. A track shorter than its chapter leaves a gap
  of a few milliseconds rather than shifting every later frame.
- **Frame steps:** a step moves exactly one frame of the chapter's own video track (1/50 s on 50
  fps footage) and lands in the middle of that frame, crossing a chapter seam frame by frame.

## CI

[`.github/workflows/mac.yml`](../.github/workflows/mac.yml) runs the tests on a macOS 26 runner
whenever `mac/`, `contracts/` or the workflow change.
