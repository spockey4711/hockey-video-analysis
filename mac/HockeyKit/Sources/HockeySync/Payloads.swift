import Foundation
import HockeyCore
import HockeyStore

/// The app API's JSON (Mac plan S2 to S4), as the Mac reads and writes it.
/// `contracts/api/*.json` holds the server's golden answers; the tests decode
/// each of them. Only the fields the Mac uses are read, so a field the server
/// adds later never breaks an older build.

/// A game's fields and versions, in a snapshot or a write's answer.
struct GamePayload: Decodable {
    let id: UUID
    let title: String
    let opponent: String?
    let playedOn: String?
    let version: Int
    let revision: Int
    let quartersVersion: Int

    var fields: GameFields { GameFields(title: title, opponent: opponent, playedOn: playedOn) }
}

/// `{"game": ...}`: an accept, a game patch, or its conflict.
struct GameEnvelope: Decodable {
    let game: GamePayload
}

/// A tag as the answers carry it. A create's answer has no players (a new
/// tag has none) and a patch's answer no id. A server from before the further
/// types sends none.
struct TagPayload: Decodable {
    let id: UUID?
    let type: String
    let extraTypes: [String]?
    let startS: Double
    let endS: Double?
    let visibility: TagVisibility
    let playerIds: [UUID]?
    let version: Int
    let createdAt: Date?

    var state: TagState {
        TagState(
            type: type,
            extraTypes: extraTypes ?? [],
            startS: startS,
            endS: endS,
            visibility: visibility,
            playerIds: playerIds ?? []
        )
    }
}

/// `{"tag": ...}`: a created or patched tag, or the tag a write clashed with.
struct TagEnvelope: Decodable {
    let tag: TagPayload
}

/// `GET /api/app/v1/games/{id}` and a registration's answer.
struct GameSnapshot: Decodable {
    let game: GamePayload
    let quarters: [Quarter]
    let tags: [TagPayload]

    func copy() throws -> ServerGameCopy {
        try ServerGameCopy(
            id: game.id,
            fields: game.fields,
            version: game.version,
            revision: game.revision,
            quarters: quarters,
            quartersVersion: game.quartersVersion,
            tags: tags.map { tag in
                guard let id = tag.id else { throw SyncError.invalidAnswer }
                return ServerTag(id: id, state: tag.state, version: tag.version, createdAt: tag.createdAt)
            }
        )
    }
}

/// `GET /api/app/v1/library`: every game with its revision, and the roster's.
struct LibraryPayload: Decodable {
    struct Game: Decodable {
        let id: UUID
        let revision: Int
    }

    let games: [Game]
    let rosterRevision: Int
}

/// `GET /api/app/v1/players`.
struct RosterPayload: Decodable {
    let rosterRevision: Int
    let players: [Player]
}

/// `GET /api/tag-windows`: each type's clip window as the team set it.
struct TagWindowsPayload: Decodable {
    struct Window: Decodable {
        let type: String
        let preS: Double
        let postS: Double
    }

    let windows: [Window]

    var byType: [String: TagWindow] {
        Dictionary(windows.map { ($0.type, TagWindow(preS: $0.preS, postS: $0.postS)) }) { first, _ in first }
    }
}

/// `PUT /api/tags/{id}/players`' answer.
struct TagPlayersEnvelope: Decodable {
    struct Saved: Decodable {
        let visibility: TagVisibility
        let playerIds: [UUID]
        let version: Int
    }

    let tagPlayers: Saved
}

/// `PUT /api/quarters`' answer, and its conflict.
struct QuartersPayload: Decodable {
    let quarters: [Quarter]
    let version: Int
}

struct TokenPayload: Decodable {
    let token: String
}

struct UpdateRequiredPayload: Decodable {
    let minVersion: String
}

// MARK: Request bodies

struct RegistrationBody: Encodable {
    struct Chapter: Encodable {
        let filePath: String
        let sizeBytes: Int64
        let durationS: Double
    }

    let id: String
    let playedOn: String?
    let chapters: [Chapter]
}

struct TagCreateBody: Encodable {
    let id: String
    let gameId: String
    let type: String
    let extraTypes: [String]
    let startS: Double
    let endS: Double?
}

/// A tag edit names its further types only when the Mac changed them: without
/// them the server keeps the ones it has (ADR 0016), so an edit of the window
/// never drops a further type the Mac has not seen yet.
struct TagEditBody: Encodable {
    let type: String
    let extraTypes: [String]?
    let startS: Double
    let endS: Double?

    init(from base: TagState, to local: TagState) {
        type = local.type
        extraTypes = local.extraTypes != base.extraTypes ? local.extraTypes : nil
        startS = local.startS
        endS = local.endS
    }
}

struct TagPlayersBody: Encodable {
    let visibility: TagVisibility
    let playerIds: [String]
}

struct QuartersBody: Encodable {
    let gameId: String
    let quarters: [Quarter]
}

struct SignInBody: Encodable {
    let email: String
    let password: String
    let deviceName: String
}

/// A game patch names only the fields that changed; a cleared opponent is an
/// explicit `null`, which the synthesized encoding would leave out.
struct GamePatchBody: Encodable {
    let title: String?
    let opponent: String??
    let playedOn: String??

    init(from base: GameFields, to local: GameFields) {
        title = local.title != base.title ? local.title : nil
        opponent = local.opponent != base.opponent ? .some(local.opponent) : nil
        playedOn = local.playedOn != base.playedOn ? .some(local.playedOn) : nil
    }

    enum CodingKeys: String, CodingKey {
        case title, opponent, playedOn
    }

    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(title, forKey: .title)
        if let opponent { try container.encode(opponent, forKey: .opponent) }
        if let playedOn { try container.encode(playedOn, forKey: .playedOn) }
    }
}

/// `POST /api/app/v1/games/{id}/accept`: the review's fields.
struct AcceptBody: Encodable {
    let title: String
    let opponent: String?
    let playedOn: String?
}

extension UUID {
    /// How ids go to the server: lowercase, as it writes them.
    var wire: String { uuidString.lowercased() }
}

extension JSONDecoder {
    /// The server's dates are ISO 8601 with milliseconds.
    static let api: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let text = try decoder.singleValueContainer().decode(String.self)
            guard let date = (try? Date(text, strategy: Date.ISO8601FormatStyle(includingFractionalSeconds: true)))
                ?? (try? Date(text, strategy: .iso8601))
            else {
                throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "not an ISO 8601 date"))
            }
            return date
        }
        return decoder
    }()
}
