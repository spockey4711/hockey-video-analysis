import AVFoundation
import Foundation
import HockeyCore
@testable import HockeyMedia
import Testing

/// Two chapters of one recording at 50 fps; the first one's sound runs 30 ms
/// past its video, as on a GoPro, so its stored duration is longer than its
/// picture.
private func writeTwoChapterGame(in temp: TemporaryFolder) async throws -> LocalGame {
    let folder = try temp.folder("Game B")
    try await SyntheticChapter.write(to: folder.appending(path: "GX010042.MP4"), frames: 100, fps: 50, audioS: 2.03)
    try await SyntheticChapter.write(to: folder.appending(path: "GX020042.MP4"), frames: 50, fps: 50, audioS: 1)
    return try await openGameFolder(folder)
}

@Suite("Game composition")
struct GameCompositionTests {
    @Test func placesEachChapterAtTheSumOfTheStoredDurations() async throws {
        let temp = try TemporaryFolder()
        let game = try await writeTwoChapterGame(in: temp)
        let composition = try await makeGameComposition(game)
        let secondStart = compositionTime(game.chapters[0].durationS)

        let video = try #require(try await composition.loadTracks(withMediaType: .video).first)
        let placed = video.segments.filter { !$0.isEmpty }.map(\.timeMapping.target)
        #expect(placed.count == 2)
        #expect(placed.first?.start == .zero)
        // The second chapter's picture starts exactly on the seam, after the
        // gap the first chapter's shorter picture leaves.
        #expect(placed.last?.start == secondStart)
        #expect(abs((placed.first?.end.seconds ?? 0) - 2) < 1e-6)

        let audio = try #require(try await composition.loadTracks(withMediaType: .audio).first)
        let sound = audio.segments.filter { !$0.isEmpty }.map(\.timeMapping.target)
        #expect(sound.last?.start == secondStart)

        let total = try await composition.load(.duration)
        #expect(abs(total.seconds - game.totalS) < 1e-6)
    }
}

@Suite("Game player")
@MainActor
struct GamePlayerTests {
    @Test func stepsOneFrameAcrossTheSeam() async throws {
        let temp = try TemporaryFolder()
        let game = try await writeTwoChapterGame(in: temp)
        let player = GamePlayer(game: game, composition: try await makeGameComposition(game))
        let seam = game.chapters[0].durationS

        // The last frame of chapter 0 is 1.98-2.00 s; the next is chapter 1's first.
        player.seek(toS: 1.99)
        player.perform(.stepFrames(1))
        #expect(abs(player.currentTimeS - (seam + 0.01)) < 1e-9)
        await player.seeksSettled()
        #expect(abs(player.player.currentTime().seconds - (seam + 0.01)) < 1e-3)

        player.perform(.stepFrames(-1))
        #expect(abs(player.currentTimeS - 1.99) < 1e-9)
        player.perform(.stepFrames(-1))
        #expect(abs(player.currentTimeS - 1.97) < 1e-9)
        await player.seeksSettled()
        #expect(abs(player.player.currentTime().seconds - 1.97) < 1e-3)
        #expect(!player.isPlaying)
    }

    @Test func clampsSkipsToTheGame() async throws {
        let temp = try TemporaryFolder()
        let game = try await writeTwoChapterGame(in: temp)
        let player = GamePlayer(game: game, composition: try await makeGameComposition(game))

        player.perform(.seek(byS: -5))
        #expect(player.currentTimeS == 0)
        player.perform(.seek(byS: 10))
        #expect(player.currentTimeS == game.totalS)
        player.perform(.step(byS: -1))
        #expect(abs(player.currentTimeS - (game.totalS - 1)) < 1e-9)
        await player.seeksSettled()
    }

    @Test func walksTheRateLadder() async throws {
        let temp = try TemporaryFolder()
        let game = try await writeTwoChapterGame(in: temp)
        let player = GamePlayer(game: game, composition: try await makeGameComposition(game))

        player.perform(.adjustRate(-1))
        player.perform(.adjustRate(-1))
        player.perform(.adjustRate(-1))
        #expect(player.rate == 0.25)
        #expect(player.player.defaultRate == 0.25)
        player.setRate(4)
        player.perform(.adjustRate(1))
        #expect(player.rate == 4)
    }
}
