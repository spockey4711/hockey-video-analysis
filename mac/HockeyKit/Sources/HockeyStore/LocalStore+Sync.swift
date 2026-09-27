import Foundation
import GRDB
import HockeyCore

/// The store's side of syncing (ADR 0013): the outbox every write adds to in
/// its own transaction, the rows' base versions, and what a pull brings in.
/// The rules of when to send what, and how to merge, live in `HockeySync`.
extension LocalStore {
    /// Adds a change to the outbox unless one of the same kind for the same
    /// row is already there: a change is sent with the row as it is then, so
    /// one entry carries every later edit too.
    func enqueue(
        _ db: Database,
        _ kind: ChangeKind,
        game gameID: UUID,
        target targetID: UUID,
        baseVersion: Int? = nil
    ) throws {
        let syncOff = try Bool.fetchOne(db, sql: "SELECT sync_off FROM game WHERE id = ?", arguments: [gameID.storedValue])
        guard syncOff != true else { return }
        let queued = try OutboxRecord
            .filter(Column("kind") == kind.rawValue && Column("target_id") == targetID.storedValue)
            .fetchCount(db)
        guard queued == 0 else { return }
        let record = OutboxRecord(
            gameId: gameID,
            kind: kind,
            targetId: targetID,
            baseVersion: baseVersion,
            state: .pending
        )
        try record.insert(db)
    }

    // MARK: Outbox

    /// Every change not yet on the server, in the order it was made.
    public func pendingChanges() throws -> [PendingChange] {
        try database.read { db in
            try OutboxRecord.order(Column("seq")).fetchAll(db).map {
                PendingChange(
                    id: $0.seq ?? 0,
                    gameID: $0.gameId,
                    kind: $0.kind,
                    targetID: $0.targetId,
                    baseVersion: $0.baseVersion,
                    state: $0.state,
                    server: $0.server,
                    failure: $0.failure
                )
            }
        }
    }

    /// The change reached the server.
    public func completeChange(_ id: Int64) throws {
        _ = try database.write { db in try OutboxRecord.deleteOne(db, key: id) }
    }

    /// Sets where a change stands: back to pending, a conflict with the
    /// server's side, or refused for good.
    public func markChange(_ id: Int64, _ state: ChangeState, server: Data? = nil, failure: String? = nil) throws {
        try database.write { db in
            guard var record = try OutboxRecord.fetchOne(db, key: id) else { return }
            record.state = state
            record.server = server
            record.failure = failure
            try record.update(db)
        }
    }

    /// A delete's base version after a merge.
    public func setBaseVersion(_ version: Int, ofChange id: Int64) throws {
        try database.write { db in
            try db.execute(sql: "UPDATE outbox SET base_version = ? WHERE seq = ?", arguments: [version, id])
        }
    }

    // MARK: Rows

    /// The games the server has and this Mac keeps in sync, with the revision
    /// last pulled.
    public func syncedGames() throws -> [(id: UUID, revision: Int?)] {
        try database.read { db in
            try GameRecord.filter(Column("version") != nil && Column("sync_off") == false).fetchAll(db)
                .map { ($0.id, $0.revision) }
        }
    }

    public func gameSync(_ id: UUID) throws -> SyncRow<GameFields>? {
        try database.read { db in
            try GameRecord.filter(key: id.storedValue).fetchOne(db).map {
                SyncRow(local: $0.fields, base: $0.base, version: $0.version)
            }
        }
    }

    public func tagSync(_ id: UUID) throws -> (gameID: UUID, row: SyncRow<TagState>)? {
        try database.read { db in
            try TagRecord.filter(key: id.storedValue).fetchOne(db).map {
                ($0.gameId, SyncRow(local: $0.state, base: $0.base, version: $0.version))
            }
        }
    }

    public func quartersSync(_ gameID: UUID) throws -> SyncRow<[Quarter]>? {
        try database.read { db in
            guard let game = try GameRecord.filter(key: gameID.storedValue).fetchOne(db) else { return nil }
            return try SyncRow<[Quarter]>(local: fetchQuarters(db, gameID), base: game.quartersBase, version: game.quartersVersion)
        }
    }

    /// Records the server's registration of a game: its fields and versions
    /// become the base the Mac's later changes start from.
    public func settleRegistration(_ copy: ServerGameCopy) throws {
        try database.write { db in
            guard var record = try GameRecord.filter(key: copy.id.storedValue).fetchOne(db) else { return }
            record.version = copy.version
            record.base = copy.fields
            record.revision = copy.revision
            record.quartersVersion = copy.quartersVersion
            record.quartersBase = copy.quarters
            try record.update(db)
        }
    }

    /// Records the server's game fields at `version` as the base, and, when
    /// given, the fields the Mac keeps from now on.
    public func settleGame(_ id: UUID, base: GameFields, version: Int, local: GameFields? = nil) throws {
        try database.write { db in
            guard var record = try GameRecord.filter(key: id.storedValue).fetchOne(db) else { return }
            record.base = base
            record.version = version
            if let local {
                record.title = local.title
                record.opponent = local.opponent
                record.playedOn = local.playedOn
            }
            try record.update(db)
        }
    }

    /// Records the server's tag at `version` as the base, and, when given, the
    /// state the Mac keeps. A tag deleted on this Mac while its create was on
    /// the way is deleted on the server next.
    public func settleTag(_ id: UUID, ofGame gameID: UUID, base: TagState, version: Int, local: TagState? = nil) throws {
        try database.write { db in
            guard var record = try TagRecord.filter(key: id.storedValue).fetchOne(db) else {
                try enqueue(db, .deleteTag, game: gameID, target: id, baseVersion: version)
                return
            }
            record.base = base
            record.version = version
            if let local { record.state = local }
            try record.update(db)
        }
    }

    /// Records the server's quarter set at `version` as the base, and, when
    /// given, the set the Mac keeps.
    public func settleQuarters(_ gameID: UUID, base: [Quarter], version: Int, local: [Quarter]? = nil) throws {
        try database.write { db in
            guard var game = try GameRecord.filter(key: gameID.storedValue).fetchOne(db) else { return }
            game.quartersBase = base
            game.quartersVersion = version
            try game.update(db)

            if let local { try writeQuarters(db, local, gameID: gameID) }
        }
    }

    /// Puts back a tag the Mac deleted after all, as the server has it.
    public func restoreTag(_ tag: ServerTag, gameID: UUID, now: Date = Date()) throws {
        try database.write { db in
            try insertServerTag(db, tag, gameID: gameID, now: now)
        }
    }

    // MARK: Pull

    /// Brings in a game's aggregate as the server has it. Rows with changes
    /// still in the outbox keep the Mac's side: those changes carry their
    /// base version, so the server finds any clash when they are sent.
    /// Returns whether anything on this Mac changed.
    @discardableResult
    public func applyServerCopy(_ copy: ServerGameCopy, now: Date = Date()) throws -> Bool {
        try database.write { db in
            let id = copy.id.storedValue
            guard var game = try GameRecord.filter(key: id).fetchOne(db) else { return false }
            let queued = try Set(OutboxRecord.filter(Column("game_id") == id).fetchAll(db).map {
                "\($0.kind == .gameFields || $0.kind == .replaceQuarters ? $0.kind.rawValue : "tag")/\($0.targetId.storedValue)"
            })
            let old = game
            var changed = false
            game.revision = copy.revision
            if !queued.contains("gameFields/\(id)") {
                game.title = copy.fields.title
                game.opponent = copy.fields.opponent
                game.playedOn = copy.fields.playedOn
                game.base = copy.fields
                game.version = copy.version
            }
            if !queued.contains("replaceQuarters/\(id)") {
                game.quartersBase = copy.quarters
                game.quartersVersion = copy.quartersVersion
                if try fetchQuarters(db, copy.id) != copy.quarters {
                    try writeQuarters(db, copy.quarters, gameID: copy.id)
                    changed = true
                }
            }
            if try game.updateChanges(db, from: old), game.fields != old.fields { changed = true }

            let serverIDs = Set(copy.tags.map(\.id))
            for local in try TagRecord.filter(Column("game_id") == id).fetchAll(db)
            where local.version != nil && !serverIDs.contains(local.id) && !queued.contains("tag/\(local.id.storedValue)") {
                try local.delete(db)
                changed = true
            }
            for tag in copy.tags where !queued.contains("tag/\(tag.id.storedValue)") {
                if var local = try TagRecord.filter(key: tag.id.storedValue).fetchOne(db) {
                    let moved = local.state != tag.state
                    try local.updateChanges(db) {
                        $0.state = tag.state
                        $0.base = tag.state
                        $0.version = tag.version
                        if moved { $0.updatedAt = now }
                    }
                    changed = changed || moved
                } else {
                    try insertServerTag(db, tag, gameID: copy.id, now: now)
                    changed = true
                }
            }
            return changed
        }
    }

    /// The server no longer lists this game (discarded or deleted in the
    /// browser): it stays on this Mac, and its changes stay here too.
    public func stopSyncing(_ gameID: UUID) throws {
        try database.write { db in
            try db.execute(sql: "UPDATE game SET sync_off = 1 WHERE id = ?", arguments: [gameID.storedValue])
            try OutboxRecord.filter(Column("game_id") == gameID.storedValue).deleteAll(db)
        }
    }

    // MARK: Roster and settings

    /// The team's roster by jersey number, then name.
    public func players() throws -> [Player] {
        try database.read { db in
            try PlayerRecord.fetchAll(db)
                .map { Player(id: $0.id, name: $0.name, jerseyNumber: $0.jerseyNumber) }
                .sorted { ($0.jerseyNumber ?? .max, $0.name) < ($1.jerseyNumber ?? .max, $1.name) }
        }
    }

    public func replaceRoster(_ players: [Player]) throws {
        try database.write { db in
            try PlayerRecord.deleteAll(db)
            for player in players {
                try PlayerRecord(id: player.id, name: player.name, jerseyNumber: player.jerseyNumber).insert(db)
            }
        }
    }

    /// A value the sync keeps between runs, as JSON.
    public func setting<Value: Decodable>(_ key: String, as _: Value.Type) throws -> Value? {
        try database.read { db in
            try SettingRecord.fetchOne(db, key: key).map { try JSONDecoder().decode(Value.self, from: $0.value) }
        }
    }

    public func setSetting(_ key: String, to value: some Encodable) throws {
        let data = try JSONEncoder().encode(value)
        try database.write { db in try SettingRecord(key: key, value: data).save(db) }
    }

    // MARK: Helpers

    private func insertServerTag(_ db: Database, _ tag: ServerTag, gameID: UUID, now: Date) throws {
        let record = TagRecord(
            id: tag.id,
            gameId: gameID,
            type: tag.state.type,
            startS: tag.state.startS,
            endS: tag.state.endS,
            createdAt: tag.createdAt ?? now,
            updatedAt: now,
            visibility: tag.state.visibility,
            playerIds: tag.state.playerIds,
            version: tag.version,
            base: tag.state
        )
        try record.save(db)
    }
}
