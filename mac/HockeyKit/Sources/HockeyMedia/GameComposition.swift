import AVFoundation
import HockeyCore

/// The whole game as one composition (ADR 0013): chapter `i` starts at the sum
/// of the stored durations before it, never at AVFoundation's own track
/// lengths. A track shorter than its chapter leaves a gap of a few
/// milliseconds instead of shifting every later frame, so a game time is the
/// same frame here as in the web app.

/// Why a game cannot be composed.
public enum GameCompositionError: Error, Equatable, Sendable {
    case chapter(ChapterProbeError)
}

/// A game time as a composition time, in whole microseconds: the precision the
/// durations carry, so chapter starts land exactly.
public func compositionTime(_ seconds: Double) -> CMTime {
    CMTime(value: Int64((seconds * 1_000_000).rounded()), timescale: 1_000_000)
}

/// Builds the composition of a game's chapters, video and sound.
public func makeGameComposition(_ game: LocalGame) async throws(GameCompositionError) -> AVComposition {
    let composition = AVMutableComposition()
    var video: AVMutableCompositionTrack?
    var audio: AVMutableCompositionTrack?

    var chapterStart = CMTime.zero
    for chapter in game.chapters {
        let asset = openChapterAsset(chapter.url)
        let chapterRange = CMTimeRange(start: .zero, duration: compositionTime(chapter.durationS))
        do {
            if let source = try await asset.loadTracks(withMediaType: .video).first {
                if video == nil {
                    video = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)
                    video?.preferredTransform = try await source.load(.preferredTransform)
                }
                try await place(source, of: chapterRange, at: chapterStart, in: video)
            }
            if let source = try await asset.loadTracks(withMediaType: .audio).first {
                if audio == nil {
                    audio = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
                }
                try await place(source, of: chapterRange, at: chapterStart, in: audio)
            }
        } catch {
            throw .chapter(.unreadable(fileName: chapter.fileName))
        }
        chapterStart = chapterStart + chapterRange.duration
    }
    return composition
}

/// Places the part of `source` that lies inside its chapter at the chapter's
/// start, keeping the track's own offset in the file: a frame at local time `t`
/// plays at `chapterStart + t`. What the track leaves uncovered stays empty.
private func place(
    _ source: AVAssetTrack,
    of chapterRange: CMTimeRange,
    at chapterStart: CMTime,
    in track: AVMutableCompositionTrack?
) async throws {
    guard let track else { return }
    let covered = try await source.load(.timeRange).intersection(chapterRange)
    guard covered.duration > .zero else { return }
    let at = chapterStart + covered.start
    // Pad the track up to where this piece starts, so the gap stays a gap and
    // the piece is not pulled forward onto the end of the previous one.
    let trackEnd = track.timeRange.end.isNumeric ? track.timeRange.end : .zero
    if at > trackEnd {
        track.insertEmptyTimeRange(CMTimeRange(start: trackEnd, end: at))
    }
    try track.insertTimeRange(covered, of: source, at: at)
}
