import AVFoundation
import Foundation
import HockeyCore
@testable import HockeyMedia
import Testing

@Suite("Chapter probe")
struct ChapterProbeTests {
    @Test func readsTheRealFrameDurationAndTheLongestTrack() async throws {
        let temp = try TemporaryFolder()
        let url = temp.url.appending(path: "GX010042.MP4")
        // 2 s of 50 fps video, with sound that runs 30 ms longer.
        try await SyntheticChapter.write(to: url, frames: 100, fps: 50, audioS: 2.03)

        let chapter = try await probeChapter(at: url)

        #expect(chapter.fileName == "GX010042.MP4")
        #expect(chapter.sizeBytes > 0)
        #expect(abs(chapter.video.frameDurationS - 0.02) < 1e-9)
        #expect(abs(chapter.video.videoStartS) < 1e-9)
        #expect(abs(chapter.video.videoEndS - 2) < 1e-9)

        // The duration is the longest track, the sound here, not the video.
        let asset = AVURLAsset(url: url, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])
        var longest = 0.0
        for track in try await asset.load(.tracks) {
            longest = max(longest, try await track.load(.timeRange).end.seconds)
        }
        #expect(chapter.durationS > 2.02)
        #expect(abs(chapter.durationS - longest) <= 0.5e-6)
        #expect(chapter.durationS == roundedToMicroseconds(chapter.durationS))
        #expect(chapter.video.durationS == chapter.durationS)
    }

    @Test func readsA25FpsChapterWithoutSound() async throws {
        let temp = try TemporaryFolder()
        let url = temp.url.appending(path: "halbzeit1.mp4")
        try await SyntheticChapter.write(to: url, frames: 25, fps: 25)

        let chapter = try await probeChapter(at: url)

        #expect(abs(chapter.video.frameDurationS - 0.04) < 1e-9)
        #expect(abs(chapter.durationS - 1) < 1e-9)
    }

    @Test func rejectsAFileThatIsNoVideo() async throws {
        let temp = try TemporaryFolder()
        let url = temp.url.appending(path: "GX010042.MP4")
        try Data("not a video".utf8).write(to: url)

        await #expect(throws: ChapterProbeError.unreadable(fileName: "GX010042.MP4")) {
            try await probeChapter(at: url)
        }
    }

    @Test func picksAFallbackFrameDuration() {
        #expect(frameDuration(minFrameDuration: CMTime(value: 1001, timescale: 60000), nominalFrameRate: 0) == 1001.0 / 60000)
        #expect(frameDuration(minFrameDuration: .invalid, nominalFrameRate: 50) == 0.02)
        #expect(frameDuration(minFrameDuration: .invalid, nominalFrameRate: 0) == 0.04)
    }
}

@Suite("Game folder")
struct GameFolderTests {
    @Test func ordersTheChaptersAndIgnoresOtherFiles() async throws {
        let temp = try TemporaryFolder()
        let folder = try temp.folder("Game A")
        try await SyntheticChapter.write(to: folder.appending(path: "GX020042.MP4"), frames: 10, fps: 25)
        try await SyntheticChapter.write(to: folder.appending(path: "GX010042.MP4"), frames: 20, fps: 25)
        try await SyntheticChapter.write(to: folder.appending(path: "GX010043.MP4"), frames: 5, fps: 25)
        try Data("notes".utf8).write(to: folder.appending(path: "notes.txt"))

        let game = try await openGameFolder(folder)

        #expect(game.title == "Game A")
        #expect(game.scheme == .gopro)
        #expect(game.chapters.map(\.fileName) == ["GX010042.MP4", "GX020042.MP4", "GX010043.MP4"])
        #expect(game.ignored == ["notes.txt"])
        #expect(game.durationsS.map { ($0 * 25).rounded() } == [20, 10, 5])
        // The third chapter is a new recording: one break, after 30 of 35 frames.
        #expect(game.breaks.count == 1)
        #expect(abs((game.breaks.first?.startFraction ?? 0) - 30.0 / 35) < 1e-6)
    }

    @Test func findsTheChaptersOnACameraCard() async throws {
        let temp = try TemporaryFolder()
        let card = try temp.folder("CARD")
        let camera = try temp.folder("CARD/DCIM/100GOPRO")
        _ = try temp.folder("CARD/MISC")
        try await SyntheticChapter.write(to: camera.appending(path: "GX010042.MP4"), frames: 5, fps: 25)

        let game = try await openGameFolder(card)

        #expect(game.title == "CARD")
        #expect(game.chapterFolder.lastPathComponent == "100GOPRO")
        #expect(game.chapters.map(\.fileName) == ["GX010042.MP4"])
    }

    @Test func reportsAFolderWithoutParts() async throws {
        let temp = try TemporaryFolder()
        try Data("notes".utf8).write(to: temp.url.appending(path: "notes.txt"))

        await #expect(throws: GameFolderError.noParts) { try await openGameFolder(temp.url) }
    }

    @Test func reportsAMissingChapter() async throws {
        let temp = try TemporaryFolder()
        try Data().write(to: temp.url.appending(path: "GX010042.MP4"))
        try Data().write(to: temp.url.appending(path: "GX030042.MP4"))

        await #expect(throws: GameFolderError.invalid(.missing(PartLabel(scheme: .gopro, recording: 42, index: 2)))) {
            try await openGameFolder(temp.url)
        }
    }

    @Test func reportsAFolderThatIsNotThere() async throws {
        let temp = try TemporaryFolder()
        await #expect(throws: GameFolderError.unreadable) {
            try await openGameFolder(temp.url.appending(path: "gone", directoryHint: .isDirectory))
        }
    }

    @Test func reportsAChapterThatCannotBePlayed() async throws {
        let temp = try TemporaryFolder()
        try Data("broken".utf8).write(to: temp.url.appending(path: "halbzeit1.mp4"))

        await #expect(throws: GameFolderError.chapter(.unreadable(fileName: "halbzeit1.mp4"))) {
            try await openGameFolder(temp.url)
        }
    }
}

@Suite("Stored durations")
struct StoredDurationTests {
    private func chapter(_ name: String, durationS: Double, videoEndS: Double) -> ChapterMedia {
        ChapterMedia(
            url: URL(filePath: "/game/\(name)"),
            fileName: name,
            sizeBytes: 10,
            durationS: durationS,
            video: ChapterVideoTiming(durationS: durationS, videoStartS: 0, videoEndS: videoEndS, frameDurationS: 0.02)
        )
    }

    @Test func placesEachChapterAtItsStoredDuration() {
        let folder = URL(filePath: "/game")
        let game = LocalGame(
            folder: folder,
            chapterFolder: folder,
            scheme: .gopro,
            chapters: [chapter("GX010042.MP4", durationS: 10.03, videoEndS: 10), chapter("GX020042.MP4", durationS: 5, videoEndS: 5)],
            ignored: []
        )

        let placed = game.placing(durationsS: [10.02, 5.01])
        #expect(placed.durationsS == [10.02, 5.01])
        #expect(placed.chapters.map(\.video.durationS) == [10.02, 5.01])
        #expect(placed.chapters.map(\.video.videoEndS) == [10, 5])
        #expect(game.placing(durationsS: [9.99, 5]).chapters[0].video.videoEndS == 9.99)
        #expect(game.placing(durationsS: [1]) == game)
    }
}
