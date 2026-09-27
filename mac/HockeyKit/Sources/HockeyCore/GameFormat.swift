/// A game's format: how many periods it plays and how long each lasts. A team
/// sets a default and a game may set its own; each of the game's values falls
/// back to the team default on its own.
///
/// Port of `resolveGameFormat` in `src/features/game-format/format.ts`, pinned
/// by `contracts/vectors/game-format.json`.

public struct GameFormat: Equatable, Hashable, Sendable {
    /// 4 quarters or 2 halves.
    public let periodCount: Int
    /// The nominal length of one period, in whole minutes as seconds.
    public let periodLengthS: Double

    public init(periodCount: Int, periodLengthS: Double) {
        self.periodCount = periodCount
        self.periodLengthS = periodLengthS
    }

    /// Four quarters of 15 minutes, the format a team starts with; a default,
    /// not a law.
    public static let standard = GameFormat(periodCount: 4, periodLengthS: 15 * 60)

    /// The period counts a game may play.
    public static let periodCounts = [4, 2]
    /// The shortest and longest period, in minutes.
    public static let periodLengthMinutes = 1...60

    public static func isPeriodCount(_ value: Int) -> Bool {
        periodCounts.contains(value)
    }

    /// Whole minutes within `periodLengthMinutes`.
    public static func isPeriodLengthS(_ value: Double) -> Bool {
        value.isFinite && value.truncatingRemainder(dividingBy: 60) == 0
            && periodLengthMinutes.contains(Int(value / 60))
    }
}

/// The format a game plays: each of its own values when set and within the
/// rules, else the team default's.
public func resolveGameFormat(
    periodCount: Int?,
    periodLengthS: Double?,
    teamDefault: GameFormat
) -> GameFormat {
    GameFormat(
        periodCount: periodCount.flatMap { GameFormat.isPeriodCount($0) ? $0 : nil } ?? teamDefault.periodCount,
        periodLengthS: periodLengthS.flatMap { GameFormat.isPeriodLengthS($0) ? $0 : nil }
            ?? teamDefault.periodLengthS
    )
}
