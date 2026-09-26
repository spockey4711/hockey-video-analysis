import Foundation
import GRDB

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
    var title: String
    var folderName: String
    /// The game's own format; `nil` plays the team default.
    var periodCount: Int?
    var periodLengthS: Double?
    var createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id, title
        case folderName = "folder_name"
        case periodCount = "period_count"
        case periodLengthS = "period_length_s"
        case createdAt = "created_at"
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
    var startS: Double
    var endS: Double?
    var createdAt: Date
    var updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id, type
        case gameId = "game_id"
        case startS = "start_s"
        case endS = "end_s"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
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
    return migrator
}
