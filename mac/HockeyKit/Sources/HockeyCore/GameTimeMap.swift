/// Global game time (ADR 0002): one coordinate in seconds since the start of the
/// game, mapped to a `(chapter, local offset)` pair over the ordered chapter
/// durations (`game_sources.duration_s`).
///
/// Port of `src/lib/time-mapping/game-time-map.ts`, pinned by
/// `contracts/vectors/time-mapping.json`. The boundary rule is load-bearing and
/// must match the web app: chapters are half-open `[start, start + duration)`, so
/// a time on an interior seam belongs to the next chapter, and only the exact
/// game end maps to the end of the last chapter.
///
/// Chapter starts are always sums of the durations in chapter order, the same
/// additions the TypeScript makes, so both apps agree on every seam bit for bit.

/// A point inside one chapter file: `localOffsetS` seconds into the chapter at
/// `sourceIndex` (0-based, in play order).
public struct SourcePoint: Equatable, Sendable {
    public let sourceIndex: Int
    public let localOffsetS: Double

    public init(sourceIndex: Int, localOffsetS: Double) {
        self.sourceIndex = sourceIndex
        self.localOffsetS = localOffsetS
    }
}

/// Why a game-time rule rejected its input. The rules reject rather than clamp,
/// because a bad layout or an out-of-range time is a bug upstream.
public enum GameTimeError: Error, Equatable, Sendable {
    /// The layout has no chapter.
    case noChapters
    /// A chapter's duration is zero, negative or not finite: a corrupt row.
    case invalidDuration(chapter: Int)
    /// A game time is not finite or lies outside `[0, total]`.
    case timeOutOfRange
    /// A chapter index names no chapter.
    case chapterOutOfRange
    /// A local offset is not finite or lies outside `[0, chapter duration]`.
    case offsetOutOfRange
    /// A window is not finite, not strictly ordered, or outside the game.
    case invalidWindow
}

/// Checks that `durationsS` is a usable layout: at least one chapter, each
/// finite and strictly positive.
func validateDurations(_ durationsS: [Double]) throws(GameTimeError) {
    if durationsS.isEmpty { throw .noChapters }
    for (index, duration) in durationsS.enumerated()
    where !duration.isFinite || duration <= 0 {
        throw .invalidDuration(chapter: index)
    }
}

/// The length of the game: the sum of every chapter's duration. Game times are
/// valid in the closed interval `[0, totalDurationS]`.
public func totalDurationS(_ durationsS: [Double]) throws(GameTimeError) -> Double {
    try validateDurations(durationsS)
    var total = 0.0
    for duration in durationsS {
        total += duration
    }
    return total
}

/// The chapter that plays at `gameTimeS` and the offset within it.
public func toSourcePoint(
    _ durationsS: [Double],
    gameTimeS: Double
) throws(GameTimeError) -> SourcePoint {
    try validateDurations(durationsS)
    guard gameTimeS.isFinite, gameTimeS >= 0 else { throw .timeOutOfRange }

    var chapterStartS = 0.0
    for (index, duration) in durationsS.enumerated() {
        if gameTimeS < chapterStartS + duration {
            return SourcePoint(sourceIndex: index, localOffsetS: gameTimeS - chapterStartS)
        }
        chapterStartS += duration
    }

    // Fell through the half-open scan: only the exact game end is still valid.
    if gameTimeS == chapterStartS {
        let lastIndex = durationsS.count - 1
        return SourcePoint(sourceIndex: lastIndex, localOffsetS: durationsS[lastIndex])
    }
    throw .timeOutOfRange
}

/// The game time of a point in a chapter: the exact inverse of `toSourcePoint`.
/// The local offset may equal the chapter's duration, its exclusive end.
public func toGameTime(
    _ durationsS: [Double],
    point: SourcePoint
) throws(GameTimeError) -> Double {
    try validateDurations(durationsS)
    guard durationsS.indices.contains(point.sourceIndex) else { throw .chapterOutOfRange }
    let duration = durationsS[point.sourceIndex]
    guard point.localOffsetS.isFinite, point.localOffsetS >= 0,
          point.localOffsetS <= duration
    else { throw .offsetOutOfRange }

    var chapterStartS = 0.0
    for index in 0..<point.sourceIndex {
        chapterStartS += durationsS[index]
    }
    return chapterStartS + point.localOffsetS
}

/// The game time each chapter starts at: chapter `i` starts at the sum of the
/// durations before it, added in chapter order.
public func chapterStartsS(_ durationsS: [Double]) throws(GameTimeError) -> [Double] {
    try validateDurations(durationsS)
    var starts: [Double] = []
    starts.reserveCapacity(durationsS.count)
    var chapterStartS = 0.0
    for duration in durationsS {
        starts.append(chapterStartS)
        chapterStartS += duration
    }
    return starts
}

/// A game time clamped into `[0, total]`, for seeks that overshoot either end
/// (a skip past the end, a step before the start). Not finite reads as 0, like
/// `clampGameTimeS` in `src/features/player/playback-plan.ts`.
public func clampGameTimeS(_ durationsS: [Double], _ gameTimeS: Double) throws(GameTimeError)
    -> Double
{
    let total = try totalDurationS(durationsS)
    guard gameTimeS.isFinite else { return 0 }
    return min(max(gameTimeS, 0), total)
}
