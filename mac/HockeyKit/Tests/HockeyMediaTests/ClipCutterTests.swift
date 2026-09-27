import AVFoundation
import Foundation
import HockeyCore
@testable import HockeyMedia
import Testing

/// The Mac's passthrough cutter (ADR 0013) on synthetic chapters: 50 fps with
/// a keyframe every half second, each frame a shade of its number, so a
/// decoded frame names the source frame it came from.
@Suite("Clip cutter")
struct ClipCutterTests {
    /// Two chapters of one recording; the first one's sound runs 30 ms past its
    /// picture, as on a GoPro.
    private func twoChapters(in temp: TemporaryFolder, reorders: Bool = false) async throws -> LocalGame {
        let folder = try temp.folder("Game C")
        try await SyntheticChapter.write(
            to: folder.appending(path: "GX010042.MP4"), frames: 150, fps: 50, audioS: 3.03,
            keyframeEvery: 25, reorders: reorders
        )
        try await SyntheticChapter.write(
            to: folder.appending(path: "GX020042.MP4"), frames: 100, fps: 50, audioS: 2,
            keyframeEvery: 25, reorders: reorders
        )
        return try await openGameFolder(folder)
    }

    private func cut(_ game: LocalGame, startS: Double, endS: Double, into temp: TemporaryFolder) async throws -> CutClipFile {
        let sources = game.chapters.enumerated().map {
            ClipSource(orderIndex: $0.offset, filePath: $0.element.fileName, durationS: $0.element.durationS)
        }
        let plan = try planClipCut(sources, startS: startS, endS: endS)
        return try await cutClip(plan, durationsS: game.durationsS, folder: game.chapterFolder, to: temp.url.appending(path: "clip.mp4"))
    }

    @Test func startsOnTheKeyframeAtOrBeforeTheTag() async throws {
        let temp = try TemporaryFolder()
        let game = try await twoChapters(in: temp)
        let clip = try await cut(game, startS: 1.3, endS: 2.2, into: temp)

        // Keyframes every 0.5 s: the one at 1.0 s.
        #expect(abs(clip.cutStartS - 1.0) < 1e-6)
        let first = try await firstFrame(of: clip.url)
        #expect(abs(first.timeS) < 1e-6)
        #expect(abs(Int(first.shade) - 50) <= 3)
        #expect(try await duration(of: clip.url) > 1.19)
        #expect(clip.sizeBytes == Int64(try Data(contentsOf: clip.url).count))
    }

    @Test func startsOnTheTagWhenAKeyframeIsThere() async throws {
        let temp = try TemporaryFolder()
        let game = try await twoChapters(in: temp)
        let clip = try await cut(game, startS: 0.5, endS: 1.2, into: temp)
        #expect(abs(clip.cutStartS - 0.5) < 1e-6)
    }

    @Test func joinsTheChaptersAcrossTheSeam() async throws {
        let temp = try TemporaryFolder()
        let game = try await twoChapters(in: temp)
        let seam = game.chapters[0].durationS
        let clip = try await cut(game, startS: 2.7, endS: seam + 1.3, into: temp)

        #expect(abs(clip.cutStartS - 2.5) < 1e-6)
        let frames = try await frames(of: clip.url)
        // The second chapter's first frame plays exactly on the seam's game time.
        let second = try #require(frames.first { $0.timeS >= seam - clip.cutStartS - 1e-6 })
        #expect(abs(clip.cutStartS + second.timeS - seam) < 1e-4)
        #expect(second.shade <= 3)
        #expect(frames.count == 25 + 65)
        // What the server's check expects: from the file start to the tag end.
        #expect(abs(try await duration(of: clip.url) - (seam + 1.3 - clip.cutStartS)) < 0.1)
        let tracks = try await AVURLAsset(url: clip.url).load(.tracks)
        #expect(tracks.map(\.mediaType).sorted { $0.rawValue < $1.rawValue } == [.audio, .video])
    }

    @Test func writesNoEditLists() async throws {
        let temp = try TemporaryFolder()
        let game = try await twoChapters(in: temp, reorders: true)
        let clip = try await cut(game, startS: 1.3, endS: 3.5, into: temp)

        let paths = try movieBoxPaths(of: clip.url)
        #expect(paths.contains("moov/trak/mdia/minf/stbl/stco") || paths.contains("moov/trak/mdia/minf/stbl/co64"))
        #expect(!paths.contains { $0.hasSuffix("edts") || $0.hasSuffix("elst") })
        // The movie header comes before the media, for playback while loading.
        let top = try topLevelBoxes(of: clip.url).map(\.type)
        #expect(top.firstIndex(of: "moov")! < top.firstIndex(of: "mdat")!)
    }

    @Test func keepsTheKeyframeOnItsGameTimeWithReorderedFrames() async throws {
        let temp = try TemporaryFolder()
        let game = try await twoChapters(in: temp, reorders: true)
        let clip = try await cut(game, startS: 1.3, endS: 2.2, into: temp)

        // The file starts with the keyframe's decode time, a little before it
        // shows; the keyframe still plays at its own game time.
        let frames = try await frames(of: clip.url)
        let first = try #require(frames.first)
        #expect(clip.cutStartS <= 1.0 + 1e-6 && clip.cutStartS > 0.9)
        #expect(abs(clip.cutStartS + first.timeS - 1.0) < 1e-4)
        #expect(abs(Int(first.shade) - 50) <= 3)
        // Every frame up to the tag end plays, one frame apart: the file's
        // durations reach the last frame shown, not just the last decoded.
        let times = frames.map { clip.cutStartS + $0.timeS }
        #expect(frames.count == 60)
        #expect(zip(times, times.dropFirst()).allSatisfy { abs($1 - $0 - 0.02) < 1e-4 })
        #expect(abs((times.last ?? 0) - 2.18) < 1e-4)
    }

    @Test func refusesAMissingChapter() async throws {
        let temp = try TemporaryFolder()
        let game = try await twoChapters(in: temp)
        try FileManager.default.removeItem(at: game.chapters[1].url)
        await #expect(throws: ClipCutError.unreadable(fileName: "GX020042.MP4")) {
            try await cut(game, startS: 2.7, endS: 3.5, into: temp)
        }
    }
}

/// A decoded frame: when it plays in the file, and its shade.
private struct Frame {
    let timeS: Double
    let shade: UInt8
}

private func frames(of url: URL) async throws -> [Frame] {
    let asset = AVURLAsset(url: url)
    let track = try #require(try await asset.loadTracks(withMediaType: .video).first)
    let reader = try AVAssetReader(asset: asset)
    let output = AVAssetReaderTrackOutput(
        track: track,
        outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
    )
    reader.add(output)
    reader.startReading()
    var frames: [Frame] = []
    while let sample = output.copyNextSampleBuffer() {
        guard let image = sample.imageBuffer else { continue }
        CVPixelBufferLockBaseAddress(image, .readOnly)
        let shade = CVPixelBufferGetBaseAddress(image)!.load(as: UInt8.self)
        CVPixelBufferUnlockBaseAddress(image, .readOnly)
        frames.append(Frame(timeS: sample.presentationTimeStamp.seconds, shade: shade))
    }
    #expect(reader.status == .completed)
    return frames
}

private func firstFrame(of url: URL) async throws -> Frame {
    try #require(try await frames(of: url).first)
}

private func duration(of url: URL) async throws -> Double {
    try await AVURLAsset(url: url).load(.duration).seconds
}
