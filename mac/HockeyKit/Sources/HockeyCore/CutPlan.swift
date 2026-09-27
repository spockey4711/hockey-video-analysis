/// A tag's clip window as the per-chapter pieces a cutter copies and joins
/// (ADR 0002, 0004).
///
/// Port of `planClipCut` in `src/features/clips/boundary/cut-plan.ts`, pinned
/// by `contracts/vectors/cut-plan.json`. Every cutter follows this plan: the
/// VPS worker for Drive games and the Mac for its own games (ADR 0013).

/// One chapter as the plan needs it: its place among the chapters, the file
/// to cut from and its duration on the game timeline.
public struct ClipSource: Equatable, Sendable {
    public let orderIndex: Int
    public let filePath: String
    public let durationS: Double

    public init(orderIndex: Int, filePath: String, durationS: Double) {
        self.orderIndex = orderIndex
        self.filePath = filePath
        self.durationS = durationS
    }
}

/// The run `[localStartS, localEndS)` of one chapter file a clip copies.
public struct ClipSourceCut: Equatable, Sendable {
    public let sourceIndex: Int
    public let filePath: String
    public let localStartS: Double
    public let localEndS: Double

    public var durationS: Double { localEndS - localStartS }
}

/// The recipe for one clip: its window and the pieces to join in order.
public struct ClipCutPlan: Equatable, Sendable {
    public let startS: Double
    public let endS: Double
    public let cuts: [ClipSourceCut]

    public var durationS: Double { endS - startS }
    /// Whether the window crosses a chapter seam.
    public var spansBoundary: Bool { cuts.count > 1 }
}

/// Why a clip cannot be planned.
public enum CutPlanError: Error, Equatable, Sendable {
    /// The chapters are not exactly the order `0..N-1`.
    case chapterOrder
    /// The window is empty, reversed or outside the game.
    case window(GameTimeError)
}

/// Orders the chapters by `orderIndex` and splits `[startS, endS]` into one
/// piece per chapter it covers, with the shared half-open seam rule.
public func planClipCut(_ sources: [ClipSource], startS: Double, endS: Double) throws(CutPlanError) -> ClipCutPlan {
    let ordered = sources.sorted { $0.orderIndex < $1.orderIndex }
    guard !ordered.isEmpty, ordered.enumerated().allSatisfy({ $0.offset == $0.element.orderIndex }) else {
        throw .chapterOrder
    }
    let segments: [SourceSegment]
    do {
        segments = try toSourceSegments(ordered.map(\.durationS), startS: startS, endS: endS)
    } catch {
        throw .window(error)
    }
    return ClipCutPlan(
        startS: startS,
        endS: endS,
        cuts: segments.map {
            ClipSourceCut(
                sourceIndex: $0.sourceIndex,
                filePath: ordered[$0.sourceIndex].filePath,
                localStartS: $0.localStartS,
                localEndS: $0.localEndS
            )
        }
    )
}
