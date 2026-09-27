import Foundation
import GRDB
import HockeyCore

/// The rows of the local store, one type per table. Column names are the
/// server's (`start_s`, `duration_s`), so a row reads the same on both sides.
/// Internal: callers see the store's public values, never a record.

protocol StoreRecord: Codable, FetchableRecord, PersistableRecord {}

extension StoreRecord {
    /// UUIDs are stored as lowercase text, as the server writes them.
    static func databaseUUIDEncodingStrategy(for _: String) -> DatabaseUUIDEncodingStrategy {
        .lowercaseString
    }
}

struct GameRecord: StoreRecord {
    static let databaseTableName = "game"

    var id: UUID
    /// The server's title: empty while the game is under review.
    var title: String
    var folderName: String
    /// The game's own format; `nil` plays the team default.
    var periodCount: Int?
    var periodLengthS: Double?
    var createdAt: Date
    var opponent: String?
    var playedOn: String?
    /// The server's row version the local fields started from, and those
    /// fields as the server had them (the merge base); `nil` until the game
    /// is registered.
    var version: Int?
    var base: GameFields?
    /// The last pulled revision of the game's aggregate.
    var revision: Int?
    var quartersVersion: Int?
    var quartersBase: [Quarter]?
    /// Set once the game left the server's library: it stays on this Mac only.
    var syncOff: Bool
    /// Where the server has the game's clips cut; `nil` until it said so.
    var mediaHome: MediaHome?
    /// A bookmark to the folder the game's chapter files were last opened
    /// from, so its clips can be cut while another game plays.
    var folderBookmark: Data?

    enum CodingKeys: String, CodingKey {
        case id, title, opponent, version, base, revision
        case mediaHome = "media_home"
        case folderBookmark = "folder_bookmark"
        case folderName = "folder_name"
        case periodCount = "period_count"
        case periodLengthS = "period_length_s"
        case createdAt = "created_at"
        case playedOn = "played_on"
        case quartersVersion = "quarters_version"
        case quartersBase = "quarters_base"
        case syncOff = "sync_off"
    }

    var fields: GameFields {
        GameFields(title: title, opponent: opponent, playedOn: playedOn)
    }
}

struct ChapterRecord: StoreRecord {
    static let databaseTableName = "chapter"

    var gameId: UUID
    var orderIndex: Int
    var fileName: String
    var sizeBytes: Int64
    var durationS: Double

    enum CodingKeys: String, CodingKey {
        case gameId = "game_id"
        case orderIndex = "order_index"
        case fileName = "file_name"
        case sizeBytes = "size_bytes"
        case durationS = "duration_s"
    }
}

struct TagRecord: StoreRecord {
    static let databaseTableName = "tag"

    var id: UUID
    var gameId: UUID
    var type: String
    var extraTypes: [String]
    var startS: Double
    var endS: Double?
    var createdAt: Date
    var updatedAt: Date
    var visibility: TagVisibility
    var playerIds: [UUID]
    /// The server's row version and state the local fields started from (the
    /// merge base); `nil` until the server has the tag.
    var version: Int?
    var base: TagState?

    enum CodingKeys: String, CodingKey {
        case id, type, visibility, version, base
        case gameId = "game_id"
        case extraTypes = "extra_types"
        case startS = "start_s"
        case endS = "end_s"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case playerIds = "player_ids"
    }

    var state: TagState {
        get {
            TagState(type: type, extraTypes: extraTypes, startS: startS, endS: endS, visibility: visibility, playerIds: playerIds)
        }
        set {
            type = newValue.type
            extraTypes = newValue.extraTypes
            startS = newValue.startS
            endS = newValue.endS
            visibility = newValue.visibility
            playerIds = newValue.playerIds
        }
    }
}

struct QuarterRecord: StoreRecord {
    static let databaseTableName = "quarter"

    var gameId: UUID
    var index: Int
    var startS: Double
    var endS: Double?

    enum CodingKeys: String, CodingKey {
        case gameId = "game_id"
        case index = "quarter_index"
        case startS = "start_s"
        case endS = "end_s"
    }
}

struct PlayerRecord: StoreRecord {
    static let databaseTableName = "player"

    var id: UUID
    var name: String
    var jerseyNumber: Int?

    enum CodingKeys: String, CodingKey {
        case id, name
        case jerseyNumber = "jersey_number"
    }
}

/// One change waiting for the server, in the order the coach made it.
struct OutboxRecord: StoreRecord {
    static let databaseTableName = "outbox"

    var seq: Int64?
    var gameId: UUID
    var kind: ChangeKind
    var targetId: UUID
    /// The version a delete names; other changes read theirs from the row.
    var baseVersion: Int?
    var state: ChangeState
    /// The server's side of a conflict, as JSON.
    var server: Data?
    /// Why the server refused the change, for the coach.
    var failure: String?

    enum CodingKeys: String, CodingKey {
        case seq, kind, state, server, failure
        case gameId = "game_id"
        case targetId = "target_id"
        case baseVersion = "base_version"
    }
}

/// A tag's newest clip as the server has it, and this Mac's work on it: the
/// file it cut, and the upload that takes the file to the server.
struct ClipRecord: StoreRecord {
    static let databaseTableName = "clip"

    var id: UUID
    var tagId: UUID
    var status: ClipStatus
    /// The file this Mac cut, in the app's clip folder, and the window it holds.
    var cutFile: String?
    var cutTagStartS: Double?
    var cutEndS: Double?
    /// The game time at the file's time 0 (`clips.cut_start_s`).
    var cutStartS: Double?
    var cutSizeBytes: Int64?
    var uploadId: UUID?
    /// The clip waits until its tag reaches this version: the server has a
    /// newer window than this Mac, or refused the file cut from the current one.
    var heldBelowVersion: Int?

    enum CodingKeys: String, CodingKey {
        case id, status
        case tagId = "tag_id"
        case cutFile = "cut_file"
        case cutTagStartS = "cut_tag_start_s"
        case cutEndS = "cut_end_s"
        case cutStartS = "cut_start_s"
        case cutSizeBytes = "cut_size_bytes"
        case uploadId = "upload_id"
        case heldBelowVersion = "held_below_version"
    }
}

/// A value the sync keeps between runs, such as the last roster revision.
struct SettingRecord: StoreRecord {
    static let databaseTableName = "setting"

    var key: String
    var value: Data
}

extension UUID {
    /// How a UUID is stored and queried: lowercase text, as the server writes
    /// it.
    var storedValue: String { uuidString.lowercased() }
}

/// The store's schema, one migration per change. A shipped migration is never
/// edited; a change adds the next one.
var storeMigrator: DatabaseMigrator {
    var migrator = DatabaseMigrator()
    migrator.registerMigration("v1: local games, tags and quarters") { db in
        try db.create(table: "game") { table in
            table.primaryKey("id", .text)
            table.column("title", .text).notNull()
            table.column("folder_name", .text).notNull()
            // The game's own format, as on the server: `NULL` plays the team
            // default, and each column falls back on its own.
            table.column("period_count", .integer)
            table.column("period_length_s", .double)
            table.column("created_at", .datetime).notNull()
        }
        // Chapters never change once the game exists (ADR 0002): tags depend
        // on their durations.
        try db.create(table: "chapter") { table in
            table.column("game_id", .text).notNull().indexed().references("game", onDelete: .cascade)
            table.column("order_index", .integer).notNull().check { $0 >= 0 }
            table.column("file_name", .text).notNull()
            table.column("size_bytes", .integer).notNull()
            table.column("duration_s", .double).notNull().check { $0 > 0 }
            table.primaryKey(["game_id", "order_index"])
        }
        try db.create(table: "tag") { table in
            table.primaryKey("id", .text)
            table.column("game_id", .text).notNull().indexed().references("game", onDelete: .cascade)
            table.column("type", .text).notNull()
            table.column("start_s", .double).notNull().check { $0 >= 0 }
            table.column("end_s", .double)
            table.column("created_at", .datetime).notNull()
            table.column("updated_at", .datetime).notNull()
            table.check(sql: "end_s IS NULL OR end_s > start_s")
        }
        try db.create(table: "quarter") { table in
            table.column("game_id", .text).notNull().indexed().references("game", onDelete: .cascade)
            table.column("quarter_index", .integer).notNull().check { $0 >= 1 }
            table.column("start_s", .double).notNull().check { $0 >= 0 }
            table.column("end_s", .double)
            table.primaryKey(["game_id", "quarter_index"])
            table.check(sql: "end_s IS NULL OR end_s > start_s")
        }
    }
    migrator.registerMigration("v2: sync with the server") { db in
        // The title is the server's from now on: empty while the game is
        // under review, which every game made on this Mac starts in.
        try db.execute(sql: "UPDATE game SET title = ''")
        try db.alter(table: "game") { table in
            table.add(column: "opponent", .text)
            table.add(column: "played_on", .text)
            table.add(column: "version", .integer)
            table.add(column: "base", .jsonText)
            table.add(column: "revision", .integer)
            table.add(column: "quarters_version", .integer)
            table.add(column: "quarters_base", .jsonText)
            table.add(column: "sync_off", .boolean).notNull().defaults(to: false)
        }
        try db.alter(table: "tag") { table in
            table.add(column: "visibility", .text).notNull().defaults(to: "team")
            table.add(column: "player_ids", .jsonText).notNull().defaults(to: "[]")
            table.add(column: "version", .integer)
            table.add(column: "base", .jsonText)
        }
        try db.create(table: "player") { table in
            table.primaryKey("id", .text)
            table.column("name", .text).notNull()
            table.column("jersey_number", .integer)
        }
        try db.create(table: "outbox") { table in
            table.autoIncrementedPrimaryKey("seq")
            // No foreign keys: a tag's delete outlives its row.
            table.column("game_id", .text).notNull()
            table.column("kind", .text).notNull()
            table.column("target_id", .text).notNull().indexed()
            table.column("base_version", .integer)
            table.column("state", .text).notNull()
            table.column("server", .blob)
            table.column("failure", .text)
        }
        try db.create(table: "setting") { table in
            table.primaryKey("key", .text)
            table.column("value", .blob).notNull()
        }
        // Every game tagged so far goes to the server once the Mac signs in.
        try db.execute(sql: """
            INSERT INTO outbox (game_id, kind, target_id, state)
            SELECT id, 'registerGame', id, 'pending' FROM game ORDER BY created_at
            """)
        try db.execute(sql: """
            INSERT INTO outbox (game_id, kind, target_id, state)
            SELECT game_id, 'createTag', id, 'pending' FROM tag ORDER BY created_at
            """)
        try db.execute(sql: """
            INSERT INTO outbox (game_id, kind, target_id, state)
            SELECT DISTINCT game_id, 'replaceQuarters', game_id, 'pending' FROM quarter
            """)
    }
    migrator.registerMigration("v3: a tag's further types") { db in
        // ADR 0016: a tag keeps its main type in `type` and may carry further
        // types, stored as a JSON list like the server's `extra_types`.
        try db.alter(table: "tag") { table in
            table.add(column: "extra_types", .jsonText).notNull().defaults(to: "[]")
        }
        // Builds before this one never read the further types the server's
        // tags carry, so every synced game is pulled again to bring them in.
        try db.execute(sql: "UPDATE game SET revision = NULL")
    }
    migrator.registerMigration("v4: clips cut on this Mac") { db in
        try db.alter(table: "game") { table in
            table.add(column: "media_home", .text)
            table.add(column: "folder_bookmark", .blob)
        }
        try db.create(table: "clip") { table in
            table.primaryKey("id", .text)
            table.column("tag_id", .text).notNull().indexed().references("tag", onDelete: .cascade)
            table.column("status", .text).notNull()
            table.column("cut_file", .text)
            table.column("cut_tag_start_s", .double)
            table.column("cut_end_s", .double)
            table.column("cut_start_s", .double)
            table.column("cut_size_bytes", .integer)
            table.column("upload_id", .text)
            table.column("held_below_version", .integer)
        }
        // Builds before this one never read the games' clips or where they
        // are cut, so every synced game is pulled again to bring them in.
        try db.execute(sql: "UPDATE game SET revision = NULL")
    }
    return migrator
}
