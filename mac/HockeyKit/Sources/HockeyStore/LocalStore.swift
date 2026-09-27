import Foundation
import GRDB
import HockeyCore

/// The Mac's local store (ADR 0013): SQLite through GRDB, holding the games
/// opened on this Mac with their chapters, tags and quarters. Every write goes
/// through this type, one transaction each, together with the outbox row that
/// takes the change to the server (`LocalStore+Sync.swift`).

/// A chapter file as the store keeps it.
public struct StoredChapter: Equatable, Hashable, Sendable {
    public let fileName: String
    public let sizeBytes: Int64
    /// The chapter's length on the game timeline; never changes once stored.
    public let durationS: Double

    public init(fileName: String, sizeBytes: Int64, durationS: Double) {
        self.fileName = fileName
        self.sizeBytes = sizeBytes
        self.durationS = durationS
    }
}

/// A game on this Mac.
public struct StoredGame: Equatable, Sendable, Identifiable {
    public let id: UUID
    /// The title, opponent and date as the coach set them; the title is empty
    /// while the game is under review.
    public let fields: GameFields
    /// The name of the folder the game was opened from.
    public let folderName: String
    /// The game's own period count and length; `nil` plays the team default.
    public let periodCount: Int?
    public let periodLengthS: Double?
    /// The chapters in play order.
    public let chapters: [StoredChapter]

    public var durationsS: [Double] { chapters.map(\.durationS) }

    /// The game's name on this Mac: its title, else its folder's name.
    public var title: String { fields.title.isEmpty ? folderName : fields.title }

    /// The format the game plays: its own values, else the team default's.
    public func format(teamDefault: GameFormat) -> GameFormat {
        resolveGameFormat(periodCount: periodCount, periodLengthS: periodLengthS, teamDefault: teamDefault)
    }
}

/// A tag on this Mac.
public struct StoredTag: Equatable, Sendable, Identifiable {
    /// Made on this Mac; the server takes it as the tag's id.
    public let id: UUID
    public let state: TagState
    public let createdAt: Date
    public let updatedAt: Date

    public var fields: TagFields { state.fields }
    public var visibility: TagVisibility { state.visibility }
    public var playerIds: [UUID] { state.playerIds }
    public var type: String { fields.type }
    public var startS: Double { fields.startS }
    public var endS: Double? { fields.endS }
}

/// Why the store refused a write.
public enum StoreError: Error, Equatable, Sendable {
    /// A game needs at least one chapter.
    case noChapters
    /// The game or tag does not exist (any more).
    case notFound
    case invalidTag(TagValidationError)
    case invalidQuarters(QuartersError)
    /// A player-specific tag names no player.
    case noPlayers
    /// A named game needs its date (the review's rule).
    case invalidGameFields
}

public final class LocalStore: Sendable {
    let database: DatabaseQueue

    /// Opens the store file at `url`, creating it and its folder when needed,
    /// and brings its schema up to date.
    public convenience init(url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try self.init(DatabaseQueue(path: url.path(percentEncoded: false)))
    }

    /// A store that lives in memory only, for tests.
    public static func inMemory() throws -> LocalStore {
        try LocalStore(DatabaseQueue())
    }

    init(_ database: DatabaseQueue) throws {
        self.database = database
        try storeMigrator.migrate(database)
    }

    // MARK: Games

    /// The game with exactly these chapter files (names and sizes, in order),
    /// or a new one when this Mac has not seen them. A known game keeps its
    /// stored durations and title, so its tags stay where they were even if
    /// the folder was renamed or moved to another disk.
    public func game(
        chapters: [StoredChapter],
        folderName: String,
        now: Date = Date()
    ) throws -> StoredGame {
        guard let first = chapters.first else { throw StoreError.noChapters }
        return try database.write { db in
            let candidates = try String.fetchAll(
                db,
                sql: "SELECT game_id FROM chapter WHERE order_index = 0 AND file_name = ? AND size_bytes = ?",
                arguments: [first.fileName, first.sizeBytes]
            )
            for id in candidates {
                let game = try fetchGame(db, id: id)
                let sameFiles = game.chapters.elementsEqual(chapters) {
                    $0.fileName == $1.fileName && $0.sizeBytes == $1.sizeBytes
                }
                if sameFiles { return game }
            }

            let record = GameRecord(
                id: UUID(),
                title: "",
                folderName: folderName,
                periodCount: nil,
                periodLengthS: nil,
                createdAt: now,
                syncOff: false
            )
            try record.insert(db)
            for (index, chapter) in chapters.enumerated() {
                try ChapterRecord(
                    gameId: record.id,
                    orderIndex: index,
                    fileName: chapter.fileName,
                    sizeBytes: chapter.sizeBytes,
                    durationS: chapter.durationS
                ).insert(db)
            }
            try enqueue(db, .registerGame, game: record.id, target: record.id)
            return try fetchGame(db, id: record.id.storedValue)
        }
    }

    /// The game with this id.
    public func game(id: UUID) throws -> StoredGame {
        try database.read { db in try fetchGame(db, id: id.storedValue) }
    }

    /// Changes the game's title, opponent and date. A title names the game,
    /// which accepts it from review, so it needs the date too.
    public func updateGameFields(_ id: UUID, to fields: GameFields) throws -> StoredGame {
        if !fields.isUnderReview, fields.playedOn == nil { throw StoreError.invalidGameFields }
        return try database.write { db in
            guard var record = try GameRecord.filter(key: id.storedValue).fetchOne(db) else {
                throw StoreError.notFound
            }
            record.title = fields.title
            record.opponent = fields.opponent
            record.playedOn = fields.playedOn
            try record.update(db)
            try enqueue(db, .gameFields, game: id, target: id)
            return try fetchGame(db, id: id.storedValue)
        }
    }

    func fetchGame(_ db: Database, id: String) throws -> StoredGame {
        guard let record = try GameRecord.filter(key: id).fetchOne(db) else { throw StoreError.notFound }
        let chapters = try ChapterRecord
            .filter(Column("game_id") == id)
            .order(Column("order_index"))
            .fetchAll(db)
        return StoredGame(
            id: record.id,
            fields: record.fields,
            folderName: record.folderName,
            periodCount: record.periodCount,
            periodLengthS: record.periodLengthS,
            chapters: chapters.map {
                StoredChapter(fileName: $0.fileName, sizeBytes: $0.sizeBytes, durationS: $0.durationS)
            }
        )
    }

    // MARK: Tags

    /// A game's tags by start time, the order of the tags rail.
    public func tags(ofGame gameID: UUID) throws -> [StoredTag] {
        try database.read { db in
            try TagRecord
                .filter(Column("game_id") == gameID.storedValue)
                .order(Column("start_s"), Column("created_at"))
                .fetchAll(db)
                .map(StoredTag.init)
        }
    }

    /// Stores a new tag after checking it as the server would.
    public func addTag(
        _ fields: TagFields,
        toGame gameID: UUID,
        types: TagTypeCatalog,
        now: Date = Date()
    ) throws -> StoredTag {
        try check(fields, types: types)
        return try database.write { db in
            guard try GameRecord.exists(db, key: gameID.storedValue) else { throw StoreError.notFound }
            let record = TagRecord(
                id: UUID(),
                gameId: gameID,
                type: fields.type,
                startS: fields.startS,
                endS: fields.endS,
                createdAt: now,
                updatedAt: now,
                visibility: .team,
                playerIds: []
            )
            try record.insert(db)
            try enqueue(db, .createTag, game: gameID, target: record.id)
            return try fetchTag(db, id: record.id)
        }
    }

    /// Replaces a tag's type and window after checking them.
    public func updateTag(
        _ id: UUID,
        to fields: TagFields,
        types: TagTypeCatalog,
        now: Date = Date()
    ) throws -> StoredTag {
        try check(fields, types: types)
        return try database.write { db in
            guard var record = try TagRecord.filter(key: id.storedValue).fetchOne(db) else {
                throw StoreError.notFound
            }
            record.type = fields.type
            record.startS = fields.startS
            record.endS = fields.endS
            record.updatedAt = now
            try record.update(db)
            try enqueue(db, .updateTag, game: record.gameId, target: id)
            return try fetchTag(db, id: id)
        }
    }

    /// Sets who a tag's clip is for. A player-specific tag names at least one
    /// player, as on the server.
    public func setTagPlayers(
        _ id: UUID,
        visibility: TagVisibility,
        playerIds: [UUID],
        now: Date = Date()
    ) throws -> StoredTag {
        var unique: [UUID] = []
        for player in playerIds where !unique.contains(player) { unique.append(player) }
        if visibility == .single, unique.isEmpty { throw StoreError.noPlayers }
        return try database.write { db in
            guard var record = try TagRecord.filter(key: id.storedValue).fetchOne(db) else {
                throw StoreError.notFound
            }
            record.visibility = visibility
            record.playerIds = unique
            record.updatedAt = now
            try record.update(db)
            try enqueue(db, .tagPlayers, game: record.gameId, target: id)
            return try fetchTag(db, id: id)
        }
    }

    /// A tag as stored, which is what every write returns: the database keeps
    /// times to the millisecond.
    func fetchTag(_ db: Database, id: UUID) throws -> StoredTag {
        guard let record = try TagRecord.filter(key: id.storedValue).fetchOne(db) else { throw StoreError.notFound }
        return StoredTag(record)
    }

    /// Deletes a tag. Its unsent changes go with it; a tag the server has is
    /// deleted there too, from the version the Mac last saw.
    public func deleteTag(_ id: UUID) throws {
        try database.write { db in
            guard let record = try TagRecord.filter(key: id.storedValue).fetchOne(db) else {
                throw StoreError.notFound
            }
            try record.delete(db)
            try OutboxRecord.filter(Column("target_id") == id.storedValue).deleteAll(db)
            if let version = record.version {
                try enqueue(db, .deleteTag, game: record.gameId, target: id, baseVersion: version)
            }
        }
    }

    private func check(_ fields: TagFields, types: TagTypeCatalog) throws {
        do {
            try validateTag(fields, types: types)
        } catch {
            throw StoreError.invalidTag(error)
        }
    }

    // MARK: Quarters

    /// A game's quarters by index.
    public func quarters(ofGame gameID: UUID) throws -> [Quarter] {
        try database.read { db in try fetchQuarters(db, gameID) }
    }

    func fetchQuarters(_ db: Database, _ gameID: UUID) throws -> [Quarter] {
        try QuarterRecord
            .filter(Column("game_id") == gameID.storedValue)
            .order(Column("quarter_index"))
            .fetchAll(db)
            .map { Quarter(index: $0.index, startS: $0.startS, endS: $0.endS) }
    }

    func writeQuarters(_ db: Database, _ quarters: [Quarter], gameID: UUID) throws {
        try QuarterRecord.filter(Column("game_id") == gameID.storedValue).deleteAll(db)
        for quarter in quarters {
            try QuarterRecord(gameId: gameID, index: quarter.index, startS: quarter.startS, endS: quarter.endS)
                .insert(db)
        }
    }

    /// Replaces a game's quarter set as one, after checking it against the
    /// period count the game plays, and returns the stored set.
    public func replaceQuarters(_ quarters: [Quarter], ofGame gameID: UUID, periodCount: Int) throws -> [Quarter] {
        try database.write { db in
            guard try GameRecord.exists(db, key: gameID.storedValue) else { throw StoreError.notFound }
            let valid: [Quarter]
            do throws(QuartersError) {
                valid = try validateQuarters(quarters, periodCount: periodCount)
            } catch {
                throw StoreError.invalidQuarters(error)
            }
            try writeQuarters(db, valid, gameID: gameID)
            try enqueue(db, .replaceQuarters, game: gameID, target: gameID)
            return valid
        }
    }
}

extension StoredTag {
    init(_ record: TagRecord) {
        self.init(
            id: record.id,
            state: record.state,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt
        )
    }
}
