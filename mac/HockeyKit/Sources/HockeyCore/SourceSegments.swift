/// A game-time window split across chapter seams (ADR 0002).
///
/// Port of `src/lib/time-mapping/boundaries/source-segments.ts`, pinned by
/// `contracts/vectors/source-segments.json`. A window may cross any number of
/// seams and becomes one segment per chapter it covers. It shares the half-open
/// rule of `toSourcePoint`: a window ending exactly on a seam stops at the
/// earlier chapter's end and adds no empty segment to the next.

/// The run `[localStartS, localEndS)` of one chapter that a window covers.
/// `localEndS` may equal the chapter's duration, its exclusive end.
public struct SourceSegment: Equatable, Sendable {
    public let sourceIndex: Int
    public let localStartS: Double
    public let localEndS: Double

    public init(sourceIndex: Int, localStartS: Double, localEndS: Double) {
        self.sourceIndex = sourceIndex
        self.localStartS = localStartS
        self.localEndS = localEndS
    }
}

/// The ordered per-chapter segments the window `[startS, endS]` covers.
public func toSourceSegments(
    _ durationsS: [Double],
    startS: Double,
    endS: Double
) throws(GameTimeError) -> [SourceSegment] {
    let total = try totalDurationS(durationsS)
    guard startS.isFinite, endS.isFinite, startS >= 0, endS <= total, startS < endS
    else { throw .invalidWindow }

    var segments: [SourceSegment] = []
    var chapterStartS = 0.0
    for (index, duration) in durationsS.enumerated() {
        let chapterEndS = chapterStartS + duration
        // Intersect the window with this chapter's half-open span; a mere touch
        // at a seam is no overlap.
        let segStartS = max(startS, chapterStartS)
        let segEndS = min(endS, chapterEndS)
        if segEndS > segStartS {
            segments.append(
                SourceSegment(
                    sourceIndex: index,
                    localStartS: segStartS - chapterStartS,
                    localEndS: segEndS - chapterStartS
                )
            )
        }
        if chapterEndS >= endS { break }
        chapterStartS = chapterEndS
    }
    return segments
}

/// Whether the window straddles at least one chapter seam.
public func windowCrossesBoundary(
    _ durationsS: [Double],
    startS: Double,
    endS: Double
) throws(GameTimeError) -> Bool {
    try toSourceSegments(durationsS, startS: startS, endS: endS).count > 1
}
