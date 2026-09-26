// swift-tools-version: 6.2

// All logic of the Mac app (ADR 0013): `HockeyCore` holds the pure rules ported
// from the web app's TypeScript and pinned by `contracts/`, `HockeyMedia` the
// AVFoundation side (reading a game folder, one composition per game, the
// player), `HockeyStore` the local store (SQLite through GRDB) and the tagging
// built on it. The app target in `mac/HockeyVideo` is views only.
//
// Warnings fail the build through `swift test -Xswiftc -warnings-as-errors`
// (CI and mac/README.md), not a setting here: Xcode builds a package it
// depends on with warnings suppressed, and the two flags cannot be combined.

import PackageDescription

let package = Package(
    name: "HockeyKit",
    platforms: [.macOS(.v26)],
    products: [
        .library(name: "HockeyCore", targets: ["HockeyCore"]),
        .library(name: "HockeyMedia", targets: ["HockeyMedia"]),
        .library(name: "HockeyStore", targets: ["HockeyStore"]),
    ],
    dependencies: [
        .package(url: "https://github.com/groue/GRDB.swift", from: "7.11.0"),
    ],
    targets: [
        // `Resources/tag-types.json` is a copy of `contracts/tag-types.json`,
        // so the app ships the web's tag types; a test fails when they differ.
        .target(name: "HockeyCore", resources: [.copy("Resources/tag-types.json")]),
        .target(name: "HockeyMedia", dependencies: ["HockeyCore"]),
        .target(
            name: "HockeyStore",
            dependencies: ["HockeyCore", .product(name: "GRDB", package: "GRDB.swift")]
        ),
        .testTarget(name: "HockeyCoreTests", dependencies: ["HockeyCore"]),
        .testTarget(name: "HockeyMediaTests", dependencies: ["HockeyMedia"]),
        .testTarget(name: "HockeyStoreTests", dependencies: ["HockeyStore"]),
    ],
    swiftLanguageModes: [.v6]
)
