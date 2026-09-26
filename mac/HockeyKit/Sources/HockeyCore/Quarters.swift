/// Quarters: spans the coach marks on the game timeline, the quarter clock
/// read from them, the timeline bands, and the breaks playback skips.
///
/// Ports of `src/features/quarters/navigation.ts`, `clock.ts`, `validation.ts`
/// and `draft.ts`, pinned by `contracts/vectors/quarters.json` and
/// `quarter-draft.json`. A quarter is half-open `[startS, end)`; an unset end
/// runs to the next quarter's start. How many periods a game has and how long
/// each lasts are the game's format (`GameFormat`), an input to every rule
/// here.

/// A quarter on the game timeline; `index` counts from 1.
public struct Quarter: Equatable, Hashable, Sendable {
    public let index: Int
    public let startS: Double
    /// The marked end, or `nil` when only the start is marked.
    public let endS: Double?

    public init(index: Int, startS: Double, endS: Double?) {
        self.index = index
        self.startS = startS
        self.endS = endS
    }
}

/// A quarter's span as fractions of the game, for the timeline bands.
public struct QuarterBand: Equatable, Sendable {
    public let index: Int
    public let startFraction: Double
    public let endFraction: Double
}

/// The quarters ordered by index; equal indices keep their order.
private func byIndex(_ quarters: [Quarter]) -> [Quarter] {
    quarters.enumerated()
        .sorted { lhs, rhs in
            lhs.element.index != rhs.element.index
                ? lhs.element.index < rhs.element.index : lhs.offset < rhs.offset
        }
        .map(\.element)
}

/// The effective end of quarter `i` of an index-sorted list: its marked end,
/// else the next start, else `fallbackS`.
private func effectiveEndS(_ sorted: [Quarter], _ i: Int, fallbackS: Double) -> Double {
    if let endS = sorted[i].endS { return endS }
    return i + 1 < sorted.count ? sorted[i + 1].startS : fallbackS
}

/// The quarter holding `gameTimeS`, or `nil` in a break, before the first or
/// after a marked last end.
public func quarterAt(_ quarters: [Quarter], gameTimeS: Double) -> Quarter? {
    guard gameTimeS.isFinite else { return nil }
    let sorted = byIndex(quarters)
    for (i, quarter) in sorted.enumerated() where gameTimeS >= quarter.startS {
        if gameTimeS < effectiveEndS(sorted, i, fallbackS: .infinity) { return quarter }
    }
    return nil
}

/// A quarter's clip window, clamped to the game; `nil` when no quarter has
/// that index.
public func quarterWindow(
    _ quarters: [Quarter],
    index: Int,
    totalDurationS: Double
) -> (startS: Double, endS: Double)? {
    let sorted = byIndex(quarters)
    guard let i = sorted.firstIndex(where: { $0.index == index }) else { return nil }
    let startS = max(0, min(sorted[i].startS, totalDurationS))
    let endS = min(effectiveEndS(sorted, i, fallbackS: totalDurationS), totalDurationS)
    return (startS, max(startS, endS))
}

/// The quarters as fractions of the game; none while the game has no length.
public func quarterBands(_ quarters: [Quarter], totalDurationS: Double) -> [QuarterBand] {
    guard totalDurationS > 0 else { return [] }
    let sorted = byIndex(quarters)
    return sorted.indices.map { i in
        QuarterBand(
            index: sorted[i].index,
            startFraction: clampFraction(sorted[i].startS / totalDurationS),
            endFraction: clampFraction(effectiveEndS(sorted, i, fallbackS: totalDurationS) / totalDurationS)
        )
    }
}

/// Where playback jumps to skip a break: the next quarter's start while
/// `gameTimeS` lies between a marked end and that start, else `nil`. Footage
/// before the first quarter and after the last is never skipped.
public func breakSkipTargetS(_ quarters: [Quarter], gameTimeS: Double) -> Double? {
    guard gameTimeS.isFinite else { return nil }
    let sorted = byIndex(quarters)
    for i in sorted.indices.dropLast() {
        guard let endS = sorted[i].endS else { continue }
        let nextStartS = sorted[i + 1].startS
        if gameTimeS >= endS, gameTimeS < nextStartS { return nextStartS }
    }
    return nil
}

/// The quarter clock: inside quarter `i` it reads `(i - 1) * periodLengthS`
/// plus the time since the quarter's start; outside every quarter the raw game
/// time runs on.
public func quarterClockS(_ quarters: [Quarter], gameTimeS: Double, periodLengthS: Double) -> Double {
    guard let quarter = quarterAt(quarters, gameTimeS: gameTimeS) else { return gameTimeS }
    return Double(quarter.index - 1) * periodLengthS + (gameTimeS - quarter.startS)
}

private func clampFraction(_ fraction: Double) -> Double {
    fraction.isFinite ? min(max(fraction, 0), 1) : 0
}

// MARK: - Validation

/// Why a quarter set cannot be stored.
public enum QuartersError: Error, Equatable, Sendable {
    /// The set is empty or has more quarters than the game's format.
    case count
    /// An index lies outside `1...periodCount`, a start is negative or not
    /// finite, or an end does not lie after its start.
    case invalidQuarter
    /// The indices do not run 1, 2, 3, ... without a gap or a repeat.
    case notContiguous
    /// A quarter starts at or before the previous one.
    case order
    /// A quarter starts before the previous quarter's marked end.
    case overlap
}

/// Checks a quarter set before it is stored and returns it sorted by index:
/// at least one and at most `periodCount` quarters, indices `1...N`, each
/// start after the previous, no overlap.
public func validateQuarters(_ quarters: [Quarter], periodCount: Int) throws(QuartersError) -> [Quarter] {
    guard !quarters.isEmpty, quarters.count <= periodCount else { throw .count }
    for quarter in quarters {
        guard (1...max(periodCount, 1)).contains(quarter.index),
              quarter.startS.isFinite, quarter.startS >= 0
        else { throw .invalidQuarter }
        if let endS = quarter.endS, !endS.isFinite || endS <= quarter.startS {
            throw .invalidQuarter
        }
    }
    let sorted = byIndex(quarters)
    for (i, quarter) in sorted.enumerated() {
        guard quarter.index == i + 1 else { throw .notContiguous }
        guard i > 0 else { continue }
        let previous = sorted[i - 1]
        if quarter.startS <= previous.startS { throw .order }
        if let endS = previous.endS, endS > quarter.startS { throw .overlap }
    }
    return sorted
}

// MARK: - Editor draft

/// One row of the quarter editor; a `nil` start means not marked yet.
public struct QuarterDraft: Equatable, Sendable, Identifiable {
    public let index: Int
    public var startS: Double?
    public var endS: Double?

    public var id: Int { index }

    public init(index: Int, startS: Double?, endS: Double?) {
        self.index = index
        self.startS = startS
        self.endS = endS
    }
}

/// Why the editor's rows cannot be saved.
public enum QuarterDraftProblem: String, Equatable, Sendable {
    /// A quarter is marked while an earlier one is not.
    case gap
    /// A quarter ends at or before its own start.
    case endBeforeStart
    /// A quarter starts at or before the previous start.
    case order
    /// A quarter starts before the previous quarter's marked end.
    case overlap
}

/// One row per period of the game's format, seeded from the stored quarters.
public func initialDraft(_ quarters: [Quarter], periodCount: Int) -> [QuarterDraft] {
    (1...max(periodCount, 1)).map { index in
        let stored = quarters.first { $0.index == index }
        return QuarterDraft(index: index, startS: stored?.startS, endS: stored?.endS)
    }
}

/// The marked rows in index order: the set that is stored.
public func toQuarters(_ draft: [QuarterDraft]) -> [Quarter] {
    draft.sorted { $0.index < $1.index }.compactMap { row in
        row.startS.map { Quarter(index: row.index, startS: $0, endS: row.endS) }
    }
}

/// The first problem that blocks saving the rows, or `nil`.
public func draftProblem(_ draft: [QuarterDraft]) -> QuarterDraftProblem? {
    let rows = draft.sorted { $0.index < $1.index }
    if let lastMarked = rows.lastIndex(where: { $0.startS != nil }),
       rows[..<lastMarked].contains(where: { $0.startS == nil })
    {
        return .gap
    }
    let quarters = toQuarters(rows)
    for (i, quarter) in quarters.enumerated() {
        if let endS = quarter.endS, endS <= quarter.startS { return .endBeforeStart }
        guard i > 0 else { continue }
        let previous = quarters[i - 1]
        if quarter.startS <= previous.startS { return .order }
        if let endS = previous.endS, endS > quarter.startS { return .overlap }
    }
    return nil
}
