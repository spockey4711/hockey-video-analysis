import AVFoundation
import HockeyCore

/// What the Mac reads from one chapter file.
public struct ChapterMedia: Equatable, Sendable {
    public let url: URL
    public let fileName: String
    public let sizeBytes: Int64
    /// The chapter's length on the game timeline: the largest stream end over
    /// its tracks (ADR 0013), in whole microseconds like ffprobe's
    /// `format.duration`, the value `game_sources.duration_s` stores.
    public let durationS: Double
    /// The chapter's video: where its frames start and end, and one frame's
    /// length, read from the video track.
    public let video: ChapterVideoTiming

    public init(url: URL, fileName: String, sizeBytes: Int64, durationS: Double, video: ChapterVideoTiming) {
        self.url = url
        self.fileName = fileName
        self.sizeBytes = sizeBytes
        self.durationS = durationS
        self.video = video
    }
}

/// Why a chapter file cannot be played.
public enum ChapterProbeError: Error, Equatable, Sendable {
    /// AVFoundation cannot read the file.
    case unreadable(fileName: String)
    /// The file has no video track.
    case noVideo(fileName: String)
    /// The file's tracks have no length.
    case noDuration(fileName: String)
}

/// Rounds seconds to whole microseconds, the precision ffprobe prints.
func roundedToMicroseconds(_ seconds: Double) -> Double {
    (seconds * 1_000_000).rounded() / 1_000_000
}

/// Opens a chapter file for reading with exact timing, as the player and the
/// probe both need it.
func openChapterAsset(_ url: URL) -> AVURLAsset {
    AVURLAsset(url: url, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])
}

/// Reads a chapter's duration and video timing.
public func probeChapter(at url: URL) async throws(ChapterProbeError) -> ChapterMedia {
    let fileName = url.lastPathComponent
    let asset = openChapterAsset(url)
    let tracks: [AVAssetTrack]
    do {
        tracks = try await asset.load(.tracks)
    } catch {
        throw .unreadable(fileName: fileName)
    }

    var endS = 0.0
    var videoTrack: AVAssetTrack?
    for track in tracks {
        guard let range = try? await track.load(.timeRange), range.end.isNumeric else { continue }
        endS = max(endS, range.end.seconds)
        if videoTrack == nil, track.mediaType == .video { videoTrack = track }
    }
    guard let videoTrack else { throw .noVideo(fileName: fileName) }
    let durationS = roundedToMicroseconds(endS)
    guard durationS > 0 else { throw .noDuration(fileName: fileName) }

    let video: ChapterVideoTiming
    do {
        let (range, minFrameDuration, nominalFrameRate) = try await videoTrack.load(
            .timeRange, .minFrameDuration, .nominalFrameRate
        )
        video = ChapterVideoTiming(
            durationS: durationS,
            videoStartS: max(range.start.seconds, 0),
            videoEndS: min(range.end.seconds, durationS),
            frameDurationS: frameDuration(minFrameDuration: minFrameDuration, nominalFrameRate: nominalFrameRate)
        )
    } catch {
        throw .unreadable(fileName: fileName)
    }

    let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize).flatMap { $0 }
    return ChapterMedia(
        url: url,
        fileName: fileName,
        sizeBytes: Int64(size ?? 0),
        durationS: durationS,
        video: video
    )
}

/// One frame's length: the track's shortest frame, else its nominal rate, else
/// 25 fps, the slowest rate a recording plausibly has.
func frameDuration(minFrameDuration: CMTime, nominalFrameRate: Float) -> Double {
    if minFrameDuration.isNumeric, minFrameDuration.seconds > 0 {
        return minFrameDuration.seconds
    }
    if nominalFrameRate > 0 { return 1 / Double(nominalFrameRate) }
    return 1.0 / 25
}
