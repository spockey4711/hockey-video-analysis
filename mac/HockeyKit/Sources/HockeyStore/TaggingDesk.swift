import Foundation
import HockeyCore
import Observation

/// One game's tagging on this Mac: its tags and quarters as the views show
/// them, and every change the coach makes, written through the local store.
/// The play position is always an argument, so the desk knows nothing about
/// the player.
@MainActor
@Observable
public final class TaggingDesk {
    public let game: StoredGame
    /// The format the game plays: its own, else the team default's.
    public let format: GameFormat
    public let catalog: TagTypeCatalog
    /// Each type's clip window, the capture rule's input: the defaults from
    /// `tag-types.json` until a team or game setting replaces them.
    public let windows: TagWindows

    /// The game's tags by start time.
    public private(set) var tags: [StoredTag]
    /// The game's stored quarters by index.
    public private(set) var quarters: [Quarter]
    /// The tag the rail's detail shows.
    public var selectedTagID: UUID?

    @ObservationIgnored private let store: LocalStore

    /// `teamFormat` is the team's default game format, 4 x 15 until the
    /// team's settings reach the Mac.
    public init(
        store: LocalStore,
        game: StoredGame,
        teamFormat: GameFormat = .standard,
        catalog: TagTypeCatalog = .bundled,
        windows: TagWindows? = nil
    ) throws {
        self.store = store
        self.game = game
        format = game.format(teamDefault: teamFormat)
        self.catalog = catalog
        self.windows = windows ?? catalog.defaultWindows
        tags = try store.tags(ofGame: game.id)
        quarters = try store.quarters(ofGame: game.id)
    }

    /// The game's length: the sum of its stored chapter durations.
    public var totalS: Double { (try? totalDurationS(game.durationsS)) ?? 0 }

    public var selectedTag: StoredTag? {
        tags.first { $0.id == selectedTagID }
    }

    public var markers: [JumpMarker] {
        tags.map { JumpMarker(id: $0.id.uuidString, type: $0.type, startS: $0.startS) }
    }

    // MARK: Tags

    /// Captures a tag of `type` at the play position with the type's window.
    @discardableResult
    public func capture(_ type: TagType, atS: Double) throws -> StoredTag {
        guard let window = windows[type.key] else { throw StoreError.invalidTag(.unknownType) }
        let (startS, endS) = try captureTag(window: window, atS: atS, maxS: totalS)
        let tag = try store.addTag(
            TagFields(type: type.key, startS: startS, endS: endS),
            toGame: game.id,
            types: catalog
        )
        try reloadTags()
        return tag
    }

    @discardableResult
    public func update(_ id: UUID, to fields: TagFields) throws -> StoredTag {
        let tag = try store.updateTag(id, to: fields, types: catalog)
        try reloadTags()
        return tag
    }

    public func delete(_ id: UUID) throws {
        try store.deleteTag(id)
        if selectedTagID == id { selectedTagID = nil }
        try reloadTags()
    }

    private func reloadTags() throws {
        tags = try store.tags(ofGame: game.id)
    }

    /// The marker after the play position (`.`).
    public func nextMarker(from gameTimeS: Double) -> JumpMarker? {
        HockeyCore.nextMarker(markers, gameTimeS: gameTimeS)
    }

    /// The marker before the play position (`,`).
    public func previousMarker(from gameTimeS: Double) -> JumpMarker? {
        HockeyCore.previousMarker(markers, gameTimeS: gameTimeS)
    }

    // MARK: Quarters

    /// Stores the quarter editor's marked rows as the game's quarter set.
    public func saveQuarters(_ quarters: [Quarter]) throws {
        self.quarters = try store.replaceQuarters(quarters, ofGame: game.id, periodCount: format.periodCount)
    }

    /// The quarter clock at a play position, in the game's period length.
    public func quarterClockS(at gameTimeS: Double) -> Double {
        HockeyCore.quarterClockS(quarters, gameTimeS: gameTimeS, periodLengthS: format.periodLengthS)
    }

    /// Where playback jumps to skip the break at a play position, if any.
    public func breakSkipTargetS(at gameTimeS: Double) -> Double? {
        HockeyCore.breakSkipTargetS(quarters, gameTimeS: gameTimeS)
    }
}
