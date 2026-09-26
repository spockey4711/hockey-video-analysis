import Foundation
import HockeyCore

/// The values the Mac and the server keep in sync (ADR 0013), as the local
/// store holds them. Their JSON is the server's, so a golden payload decodes
/// into them.

/// Who a tag's clip is for: the whole team, or only the players it names.
public enum TagVisibility: String, Codable, Equatable, Hashable, Sendable {
    case team
    case single
}

/// A tag's synced fields: what the Mac and the browser can both change.
public struct TagState: Codable, Equatable, Hashable, Sendable {
    public var type: String
    public var startS: Double
    public var endS: Double?
    public var visibility: TagVisibility
    public var playerIds: [UUID]

    public init(type: String, startS: Double, endS: Double?, visibility: TagVisibility = .team, playerIds: [UUID] = []) {
        self.type = type
        self.startS = startS
        self.endS = endS
        self.visibility = visibility
        self.playerIds = playerIds
    }

    public var fields: TagFields {
        get { TagFields(type: type, startS: startS, endS: endS) }
        set {
            type = newValue.type
            startS = newValue.startS
            endS = newValue.endS
        }
    }
}

/// A game's own fields as the server keeps them. An empty title means the
/// game is still under review, like every game registered from this Mac.
public struct GameFields: Codable, Equatable, Hashable, Sendable {
    public var title: String
    public var opponent: String?
    /// `YYYY-MM-DD`.
    public var playedOn: String?

    public init(title: String, opponent: String?, playedOn: String?) {
        self.title = title
        self.opponent = opponent
        self.playedOn = playedOn
    }

    public var isUnderReview: Bool { title.isEmpty }
}

/// A player of the team's roster.
public struct Player: Codable, Equatable, Hashable, Sendable, Identifiable {
    public let id: UUID
    public let name: String
    public let jerseyNumber: Int?

    public init(id: UUID, name: String, jerseyNumber: Int?) {
        self.id = id
        self.name = name
        self.jerseyNumber = jerseyNumber
    }
}

/// What a change in the outbox does on the server.
public enum ChangeKind: String, Codable, Equatable, Sendable {
    case registerGame
    case gameFields
    case createTag
    case updateTag
    case tagPlayers
    case deleteTag
    case replaceQuarters
}

/// Where a change stands.
public enum ChangeState: String, Codable, Equatable, Sendable {
    /// Waiting to be sent.
    case pending
    /// The server's row moved in the same field; the coach picks a side.
    case conflict
    /// The server refused it for good; it waits until the coach drops it.
    case failed
}

/// A change waiting for the server.
public struct PendingChange: Equatable, Sendable, Identifiable {
    /// The outbox order.
    public let id: Int64
    public let gameID: UUID
    public let kind: ChangeKind
    /// The game for game-level changes, else the tag.
    public let targetID: UUID
    public let baseVersion: Int?
    public let state: ChangeState
    /// The server's side of a conflict, as JSON.
    public let server: Data?
    public let failure: String?
}

/// A row's sync state: the Mac's fields, the server's fields they started
/// from (the merge base) and that base's version, `nil` until the server has
/// the row.
public struct SyncRow<State: Equatable & Sendable>: Equatable, Sendable {
    public let local: State
    public let base: State?
    public let version: Int?
}

/// A tag as the server has it, for a pull or a merge.
public struct ServerTag: Equatable, Sendable {
    public let id: UUID
    public let state: TagState
    public let version: Int
    public let createdAt: Date?

    public init(id: UUID, state: TagState, version: Int, createdAt: Date?) {
        self.id = id
        self.state = state
        self.version = version
        self.createdAt = createdAt
    }
}

/// A game's aggregate as the server has it: what a pull writes.
public struct ServerGameCopy: Equatable, Sendable {
    public let id: UUID
    public let fields: GameFields
    public let version: Int
    public let revision: Int
    public let quarters: [Quarter]
    public let quartersVersion: Int
    public let tags: [ServerTag]

    public init(
        id: UUID,
        fields: GameFields,
        version: Int,
        revision: Int,
        quarters: [Quarter],
        quartersVersion: Int,
        tags: [ServerTag]
    ) {
        self.id = id
        self.fields = fields
        self.version = version
        self.revision = revision
        self.quarters = quarters
        self.quartersVersion = quartersVersion
        self.tags = tags
    }
}
