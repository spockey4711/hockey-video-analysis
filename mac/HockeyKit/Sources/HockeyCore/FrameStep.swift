/// Single-frame steps on the game timeline, by each chapter's real frames.
///
/// A chapter's video frames sit at `videoStartS + k * frameDurationS` in the
/// chapter, up to its video end, which may lie a few milliseconds before the
/// chapter's stored duration (the audio track runs longer). A step moves to
/// the neighbouring frame and lands in its middle, so the frame shown never
/// depends on rounding at a frame edge. At a seam it crosses into the first
/// frame of the next chapter, or the last frame of the previous one, never into
/// the short gap between a chapter's last frame and the next chapter.

/// One chapter's video, as the frame step needs it. Times are seconds in the
/// chapter.
public struct ChapterVideoTiming: Equatable, Sendable {
    /// The chapter's stored duration, its length on the game timeline.
    public let durationS: Double
    /// Where the chapter's first video frame starts.
    public let videoStartS: Double
    /// Where the chapter's video ends: the end of its last frame.
    public let videoEndS: Double
    /// The length of one frame (1/50 s for 50 fps footage).
    public let frameDurationS: Double

    public init(durationS: Double, videoStartS: Double, videoEndS: Double, frameDurationS: Double) {
        self.durationS = durationS
        self.videoStartS = videoStartS
        self.videoEndS = videoEndS
        self.frameDurationS = frameDurationS
    }

    /// Whether the timing describes at least one frame inside the chapter.
    var isUsable: Bool {
        [durationS, videoStartS, videoEndS, frameDurationS].allSatisfy(\.isFinite)
            && durationS > 0 && frameDurationS > 0
            && videoStartS >= 0 && videoEndS > videoStartS
    }

    /// The index of the last frame.
    var lastFrame: Int {
        // A frame that starts before the video end is a frame; the small
        // allowance keeps a float sum from inventing a frame at the very end.
        max(Int(((videoEndS - videoStartS) / frameDurationS - 1e-6).rounded(.up)) - 1, 0)
    }

    /// The frame shown at `localS`, held to `-1 ... lastFrame`: -1 before the
    /// first frame, the last frame after the video ends.
    func frame(atLocalS localS: Double) -> Int {
        let index = Int(((localS - videoStartS) / frameDurationS + 1e-9).rounded(.down))
        return min(max(index, -1), lastFrame)
    }

    /// The middle of a frame, in the chapter.
    func middle(ofFrame frame: Int) -> Double {
        min(videoStartS + (Double(frame) + 0.5) * frameDurationS, durationS)
    }
}

/// The game time `frames` frames away from `gameTimeS` (negative steps back),
/// in the middle of that frame. Held at the first and last frame of the game.
public func frameStepTargetS(
    _ chapters: [ChapterVideoTiming],
    fromGameTimeS gameTimeS: Double,
    frames: Int
) throws(GameTimeError) -> Double {
    let durations = chapters.map(\.durationS)
    let starts = try chapterStartsS(durations)
    if let bad = chapters.firstIndex(where: { !$0.isUsable }) {
        throw .invalidDuration(chapter: bad)
    }
    let point = try toSourcePoint(durations, gameTimeS: clampGameTimeS(durations, gameTimeS))

    var chapter = point.sourceIndex
    var frame = chapters[chapter].frame(atLocalS: point.localOffsetS)
    for _ in 0..<abs(frames) {
        if frames > 0 {
            if frame < chapters[chapter].lastFrame {
                frame += 1
            } else if chapter < chapters.count - 1 {
                chapter += 1
                frame = 0
            }
        } else if frame > 0 {
            frame -= 1
        } else if chapter > 0 {
            chapter -= 1
            frame = chapters[chapter].lastFrame
        } else {
            frame = 0
        }
    }
    // Before the first frame of the game (a leading gap) the first frame is
    // the nearest real frame in either direction.
    frame = max(frame, 0)
    return starts[chapter] + chapters[chapter].middle(ofFrame: frame)
}
