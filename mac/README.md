# Hockey Video for the Mac

The coach's editing desk as a native SwiftUI app ([ADR 0013](../docs/decisions/0013-native-mac-app-is-the-coachs-editing-desk.md)):
games straight from the camera card or the SSD, at full quality and without network traffic.
The [Mac app plan](../docs/project/mac-app-plan.md) lists the slices. So far the app plays a game
folder as one continuous game (M1) and ships as a signed build that updates itself (M2).

## Layout

| Path                                | What it holds                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------ |
| `HockeyKit/`                        | A Swift package with all logic, fully unit-tested                                    |
| `HockeyKit/Sources/HockeyCore/`     | Pure rules ported from the web's TypeScript, pinned by [`contracts/`](../contracts/) |
| `HockeyKit/Sources/HockeyMedia/`    | AVFoundation: reading a game folder, the game's composition, the player              |
| `HockeyVideo/HockeyVideo.xcodeproj` | The app project; its sources are a buildable folder, so new files never touch it     |
| `HockeyVideo/HockeyVideo/`          | The app target: SwiftUI views only, German copy in `Localizable.xcstrings`           |
| `HockeyVideo/HockeyVideo.xcconfig`  | Target settings outside the project file: the update key, the local signing include  |
| `HockeyVideo/Info.plist`            | The updater's settings (feed, key, daily checks), merged into the generated plist    |
| `Local.xcconfig.example`            | Your own signing values; copy it to the gitignored `Local.xcconfig`                  |
| `scripts/`                          | Scripts the release workflow runs                                                    |

Rules live in `HockeyKit`, never in a view. A rule the web app also has is a port: its golden
vectors come first (`contracts/README.md`), and its Swift tests read them.

## Requirements

macOS 26 and Xcode 26 (Swift 6.2 or newer). The app's one package dependency is
[Sparkle 2](https://sparkle-project.org) for updates, which Xcode fetches at the version
`HockeyVideo.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` pins.

## Test

```bash
cd mac/HockeyKit
swift test -Xswiftc -warnings-as-errors
```

The rule tests read `contracts/vectors/*.json` from this checkout, so a rule changed in the
TypeScript fails here until the port follows. The media tests write short synthetic chapters into
a temporary folder; no footage is ever committed.

## Build and run

Open `mac/HockeyVideo/HockeyVideo.xcodeproj` in Xcode and run the `HockeyVideo` scheme, or build
from the command line the way CI does:

```bash
xcodebuild build -project mac/HockeyVideo/HockeyVideo.xcodeproj -scheme HockeyVideo \
  -configuration Release -destination "generic/platform=macOS" \
  -onlyUsePackageVersionsFromResolvedFile CODE_SIGNING_ALLOWED=NO
```

Local builds carry only an ad-hoc signature, which is enough to run them on the Mac that built
them. To sign them with your own team, copy `Local.xcconfig.example` to `Local.xcconfig` (it is
gitignored) and fill it in. The team id, certificates and keys never go into this folder.

To open a game without the folder picker, hand the folder to the app:

```bash
open -a HockeyVideo "/Volumes/<ssd>/<game folder>"
```

## What the app does with a game folder

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

## Updates

The app checks this repository's `mac-appcast` release for updates once a day and installs
updates signed with the Sparkle key; "Nach Updates suchen …" in the app menu checks at once. A
build whose `SUPublicEDKey` is still the placeholder in `HockeyVideo.xcconfig` leaves the updater
off and that menu item disabled.

## CI and releases

[`.github/workflows/mac.yml`](../.github/workflows/mac.yml) runs the tests and an unsigned build
on a macOS 26 runner whenever `mac/`, `contracts/` or the workflow change. A `mac-v*` tag runs
[`.github/workflows/mac-release.yml`](../.github/workflows/mac-release.yml), which signs,
notarizes and publishes the build; [`docs/ops/mac-release.md`](../docs/ops/mac-release.md) covers
the one-time setup and how to cut a release.
