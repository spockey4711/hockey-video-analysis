import Foundation
import HockeyCore
import HockeyStore

/// Why the server refused a change for good.
public enum ChangeFailure: String, Sendable {
    /// Another game on the server already has this game's folder.
    case folderTaken
    /// The id the Mac made belongs to another game or tag.
    case idTaken
    /// The server refused the change as invalid.
    case refused
}

/// The server's side of a clash, kept with the change until the coach picks.
struct ServerSide<State: Codable>: Codable {
    let state: State
    let version: Int
    var createdAt: Date?
}

/// A change the server refused because its row moved in the same field.
public struct Conflict: Identifiable, Sendable {
    public enum Sides: Sendable {
        /// `mine` is `nil` for a tag this Mac deleted.
        case tag(mine: TagState?, server: TagState)
        case game(mine: GameFields, server: GameFields)
        case quarters(mine: [Quarter], server: [Quarter])
    }

    public let change: PendingChange
    /// The fields both sides changed differently.
    public let fields: [SyncFieldName]
    public let sides: Sides

    public var id: Int64 { change.id }
}

/// Push and pull with one server (ADR 0013). Push sends the outbox in order:
/// creates carry the Mac's ids, so a retry is harmless, and every update or
/// delete names its base version. Pull fetches the library and a snapshot of
/// each game whose revision moved. The rules live here, the rows in the store.
struct SyncEngine: Sendable {
    let store: LocalStore
    let client: APIClient

    // MARK: Push

    /// Sends every change that can go. A change waiting on the coach, or
    /// refused for good, holds back the later changes of its row, and a
    /// game's registration holds back everything of that game.
    func push() async throws {
        var heldRows = Set<UUID>()
        var heldGames = Set<UUID>()
        for change in try store.pendingChanges() {
            let held = change.state != .pending || heldRows.contains(change.targetID) || heldGames.contains(change.gameID)
            if !held, try await send(change) { continue }
            heldRows.insert(change.targetID)
            if change.kind == .registerGame { heldGames.insert(change.gameID) }
        }
    }

    /// Sends one change; `false` when it has to wait.
    private func send(_ change: PendingChange, attempt: Int = 0) async throws -> Bool {
        // A merge sends the change again; a row that keeps moving waits for
        // the next sync rather than looping.
        guard attempt < 3 else { return true }
        switch change.kind {
        case .registerGame: return try await register(change)
        case .gameFields: return try await sendGameFields(change, attempt)
        case .createTag: return try await createTag(change)
        case .updateTag, .tagPlayers: return try await sendTag(change, attempt)
        case .deleteTag: return try await deleteTag(change)
        case .replaceQuarters: return try await sendQuarters(change, attempt)
        }
    }

    private func register(_ change: PendingChange) async throws -> Bool {
        let game = try store.game(id: change.gameID)
        let body = RegistrationBody(
            id: game.id.wire,
            playedOn: game.fields.playedOn,
            chapters: game.chapters.map {
                .init(filePath: "\(game.folderName)/\($0.fileName)", sizeBytes: $0.sizeBytes, durationS: $0.durationS)
            }
        )
        let answer = try await client.send("POST", "api/app/v1/games", body: body)
        switch answer.status {
        case 200, 201:
            try store.settleRegistration(answer.decode(GameSnapshot.self).copy())
            return try done(change)
        case 409:
            let folderTaken = (try? answer.decode(ErrorPayload.self).error.contains("folder")) == true
            return try fail(change, folderTaken ? .folderTaken : .idTaken)
        default:
            return try fail(change, .refused)
        }
    }

    private func sendGameFields(_ change: PendingChange, _ attempt: Int) async throws -> Bool {
        let id = change.targetID
        guard let row = try store.gameSync(id), let base = row.base, let version = row.version else { return false }
        if row.local == base { return try done(change) }
        // A game under review is named by accepting it, as in the review.
        let answer = if base.isUnderReview, !row.local.isUnderReview {
            try await client.send(
                "POST",
                "api/app/v1/games/\(id.wire)/accept",
                body: AcceptBody(title: row.local.title, opponent: row.local.opponent, playedOn: row.local.playedOn)
            )
        } else {
            try await client.send("PATCH", "api/app/v1/games/\(id.wire)", body: GamePatchBody(from: base, to: row.local), ifMatch: version)
        }
        switch answer.status {
        case 200:
            let game = try answer.decode(GameEnvelope.self).game
            let unchanged = try store.gameSync(id)?.local == row.local
            try store.settleGame(id, base: game.fields, version: game.version, local: unchanged ? game.fields : nil)
            return try await send(change, attempt: attempt + 1)
        case 409:
            let game = try answer.decode(GameEnvelope.self).game
            return try await clash(change, row, theirs: game.fields, version: game.version, fields: GameFields.syncFields, attempt) {
                try store.settleGame(id, base: $0, version: $1, local: $2)
            }
        case 404:
            return try done(change)
        default:
            return try fail(change, .refused)
        }
    }

    private func createTag(_ change: PendingChange) async throws -> Bool {
        let id = change.targetID
        guard let (gameID, row) = try store.tagSync(id), row.version == nil else { return try done(change) }
        let sent = row.local
        let body = TagCreateBody(id: id.wire, gameId: gameID.wire, type: sent.type, startS: sent.startS, endS: sent.endS)
        let answer = try await client.send("POST", "api/tags", body: body)
        switch answer.status {
        case 200, 201:
            let tag = try answer.decode(TagEnvelope.self).tag
            try settleTag(id, gameID, sent: sent, base: tag.state, version: tag.version, echo: [.type, .window])
            return try done(change)
        case 409:
            return try fail(change, .idTaken)
        default:
            return try fail(change, .refused)
        }
    }

    /// An edit of the type and window, or of the players and visibility.
    private func sendTag(_ change: PendingChange, _ attempt: Int) async throws -> Bool {
        let id = change.targetID
        guard let (gameID, row) = try store.tagSync(id) else { return try done(change) }
        guard let base = row.base, let version = row.version else { return false }
        let isPlayers = change.kind == .tagPlayers
        let own: Set<SyncFieldName> = isPlayers ? [.players] : [.type, .window]
        let fields = TagState.syncFields.filter { own.contains($0.name) }
        if fields.allSatisfy({ $0.same(row.local, base) }) { return try done(change) }

        let sent = row.local
        let answer = if isPlayers {
            try await client.send(
                "PUT",
                "api/tags/\(id.wire)/players",
                body: TagPlayersBody(visibility: sent.visibility, playerIds: sent.playerIds.map(\.wire)),
                ifMatch: version
            )
        } else {
            try await client.send(
                "PATCH",
                "api/tags/\(id.wire)",
                body: TagEditBody(type: sent.type, startS: sent.startS, endS: sent.endS),
                ifMatch: version
            )
        }
        switch answer.status {
        case 200:
            var saved = base
            let newVersion: Int
            if isPlayers {
                let players = try answer.decode(TagPlayersEnvelope.self).tagPlayers
                saved.visibility = players.visibility
                saved.playerIds = players.playerIds
                newVersion = players.version
            } else {
                let tag = try answer.decode(TagEnvelope.self).tag
                saved.fields = tag.state.fields
                newVersion = tag.version
            }
            try settleTag(id, gameID, sent: sent, base: saved, version: newVersion, echo: own)
            return try await send(change, attempt: attempt + 1)
        case 409:
            let tag = try answer.decode(TagEnvelope.self).tag
            return try await clash(change, row, theirs: tag.state, version: tag.version, fields: TagState.syncFields, attempt) {
                try store.settleTag(id, ofGame: gameID, base: $0, version: $1, local: $2)
            }
        case 404:
            // Deleted in the browser: the next pull removes it here too.
            return try done(change)
        default:
            return try fail(change, .refused)
        }
    }

    private func deleteTag(_ change: PendingChange) async throws -> Bool {
        guard let version = change.baseVersion else { return try done(change) }
        let answer = try await client.send("DELETE", "api/tags/\(change.targetID.wire)", ifMatch: version)
        switch answer.status {
        case 204, 404:
            return try done(change)
        case 409:
            // Changed in the browser since: the coach decides whether it goes.
            let tag = try answer.decode(TagEnvelope.self).tag
            let side = ServerSide(state: tag.state, version: tag.version, createdAt: tag.createdAt)
            try store.markChange(change.id, .conflict, server: JSONEncoder().encode(side))
            return false
        default:
            return try fail(change, .refused)
        }
    }

    private func sendQuarters(_ change: PendingChange, _ attempt: Int) async throws -> Bool {
        let gameID = change.gameID
        guard let row = try store.quartersSync(gameID), let version = row.version else { return false }
        // The server keeps at least one quarter; the Mac never saves none.
        if row.local == row.base || row.local.isEmpty { return try done(change) }
        let answer = try await client.send(
            "PUT",
            "api/quarters",
            body: QuartersBody(gameId: gameID.wire, quarters: row.local),
            ifMatch: version
        )
        switch answer.status {
        case 200:
            let saved = try answer.decode(QuartersPayload.self)
            let unchanged = try store.quartersSync(gameID)?.local == row.local
            try store.settleQuarters(gameID, base: saved.quarters, version: saved.version, local: unchanged ? saved.quarters : nil)
            return try await send(change, attempt: attempt + 1)
        case 409:
            let current = try answer.decode(QuartersPayload.self)
            return try await clash(change, row, theirs: current.quarters, version: current.version, fields: quarterSetFields, attempt) {
                try store.settleQuarters(gameID, base: $0, version: $1, local: $2)
            }
        default:
            return try fail(change, .refused)
        }
    }

    /// Takes the server's answer as the tag's base. When the tag did not
    /// change meanwhile, the Mac keeps the server's values of the fields it
    /// sent, so a time the server rounded is not sent again.
    private func settleTag(
        _ id: UUID,
        _ gameID: UUID,
        sent: TagState,
        base: TagState,
        version: Int,
        echo: Set<SyncFieldName>
    ) throws {
        var local: TagState?
        if let current = try store.tagSync(id)?.row.local, current == sent {
            var echoed = current
            for field in TagState.syncFields where echo.contains(field.name) { field.take(&echoed, base) }
            local = echoed
        }
        try store.settleTag(id, ofGame: gameID, base: base, version: version, local: local)
    }

    /// A `409`: merges the server's row into the Mac's and sends the change
    /// again, or keeps it for the coach when a field clashes.
    private func clash<State: Codable & Equatable & Sendable>(
        _ change: PendingChange,
        _ row: SyncRow<State>,
        theirs: State,
        version: Int,
        fields: [SyncField<State>],
        _ attempt: Int,
        settle: (State, Int, State) throws -> Void
    ) async throws -> Bool {
        let result = merge(base: row.base ?? theirs, mine: row.local, theirs: theirs, fields: fields)
        guard result.clashes.isEmpty else {
            try store.markChange(change.id, .conflict, server: JSONEncoder().encode(ServerSide(state: theirs, version: version)))
            return false
        }
        try settle(theirs, version, result.merged)
        return try await send(change, attempt: attempt + 1)
    }

    private func done(_ change: PendingChange) throws -> Bool {
        try store.completeChange(change.id)
        return true
    }

    private func fail(_ change: PendingChange, _ failure: ChangeFailure) throws -> Bool {
        try store.markChange(change.id, .failed, failure: failure.rawValue)
        return false
    }

    // MARK: Pull

    /// Brings in what moved on the server: the roster when its revision
    /// moved, the team's tag windows, and each synced game whose revision
    /// moved. A game gone from the server stays on this Mac, unsynced.
    /// Returns whether anything on this Mac changed.
    func pull() async throws -> Bool {
        let library = try await client.get("api/app/v1/library", as: LibraryPayload.self)
        var changed = false

        if try store.setting(SettingKey.rosterRevision, as: Int.self) != library.rosterRevision {
            let roster = try await client.get("api/app/v1/players", as: RosterPayload.self)
            try store.replaceRoster(roster.players)
            try store.setSetting(SettingKey.rosterRevision, to: roster.rosterRevision)
            changed = true
        }

        let windows = try await client.get("api/tag-windows", as: TagWindowsPayload.self).byType
        if try store.setting(SettingKey.tagWindows, as: [String: TagWindow].self) != windows {
            try store.setSetting(SettingKey.tagWindows, to: windows)
            changed = true
        }

        let revisions = Dictionary(library.games.map { ($0.id, $0.revision) }) { first, _ in first }
        for game in try store.syncedGames() where revisions[game.id] == nil || revisions[game.id] != game.revision {
            let answer = try await client.send("GET", "api/app/v1/games/\(game.id.wire)")
            switch answer.status {
            case 200:
                changed = try store.applyServerCopy(answer.decode(GameSnapshot.self).copy()) || changed
            case 404:
                try store.stopSyncing(game.id)
                changed = true
            default:
                throw SyncError.invalidAnswer
            }
        }
        return changed
    }
}

/// The keys of the values the sync keeps in the store.
enum SettingKey {
    static let rosterRevision = "rosterRevision"
    static let tagWindows = "tagWindows"
}

/// The `error` every refusal names, for telling refusals apart.
struct ErrorPayload: Decodable {
    let error: String
}

/// Conflicts need no server: the coach decides on this Mac, and the next push
/// sends the result.
extension LocalStore {
    /// The changes waiting on the coach, with both sides.
    public func conflicts() throws -> [Conflict] {
        try pendingChanges().filter { $0.state == .conflict }.compactMap(conflict)
    }

    private func conflict(_ change: PendingChange) throws -> Conflict? {
        guard let server = change.server else { return nil }
        let decoder = JSONDecoder()
        switch change.kind {
        case .gameFields:
            let theirs = try decoder.decode(ServerSide<GameFields>.self, from: server).state
            guard let row = try gameSync(change.targetID) else { return nil }
            let clashes = merge(base: row.base ?? theirs, mine: row.local, theirs: theirs, fields: GameFields.syncFields).clashes
            return Conflict(change: change, fields: clashes, sides: .game(mine: row.local, server: theirs))
        case .updateTag, .tagPlayers, .deleteTag:
            let theirs = try decoder.decode(ServerSide<TagState>.self, from: server).state
            guard change.kind != .deleteTag, let row = try tagSync(change.targetID)?.row else {
                return Conflict(change: change, fields: [], sides: .tag(mine: nil, server: theirs))
            }
            let clashes = merge(base: row.base ?? theirs, mine: row.local, theirs: theirs, fields: TagState.syncFields).clashes
            return Conflict(change: change, fields: clashes, sides: .tag(mine: row.local, server: theirs))
        case .replaceQuarters:
            let theirs = try decoder.decode(ServerSide<[Quarter]>.self, from: server).state
            guard let row = try quartersSync(change.gameID) else { return nil }
            return Conflict(change: change, fields: [.quarters], sides: .quarters(mine: row.local, server: theirs))
        case .registerGame, .createTag:
            return nil
        }
    }

    /// The coach's pick: the clashing fields take that side, and the change
    /// goes out again from the server's version.
    public func resolve(_ change: PendingChange, side: ConflictSide) throws {
        guard change.state == .conflict, let server = change.server else { return }
        let decoder = JSONDecoder()
        switch change.kind {
        case .gameFields:
            let theirs = try decoder.decode(ServerSide<GameFields>.self, from: server)
            guard let row = try gameSync(change.targetID) else { return try completeChange(change.id) }
            let merged = merge(base: row.base ?? theirs.state, mine: row.local, theirs: theirs.state, fields: GameFields.syncFields, side: side)
            try settleGame(change.targetID, base: theirs.state, version: theirs.version, local: merged.merged)
        case .updateTag, .tagPlayers, .createTag:
            let theirs = try decoder.decode(ServerSide<TagState>.self, from: server)
            guard let (gameID, row) = try tagSync(change.targetID) else { return try completeChange(change.id) }
            let merged = merge(base: row.base ?? theirs.state, mine: row.local, theirs: theirs.state, fields: TagState.syncFields, side: side)
            try settleTag(change.targetID, ofGame: gameID, base: theirs.state, version: theirs.version, local: merged.merged)
        case .deleteTag:
            let theirs = try decoder.decode(ServerSide<TagState>.self, from: server)
            guard side == .mine else {
                let tag = ServerTag(id: change.targetID, state: theirs.state, version: theirs.version, createdAt: theirs.createdAt)
                try restoreTag(tag, gameID: change.gameID)
                return try completeChange(change.id)
            }
            try setBaseVersion(theirs.version, ofChange: change.id)
        case .replaceQuarters:
            let theirs = try decoder.decode(ServerSide<[Quarter]>.self, from: server)
            try settleQuarters(change.gameID, base: theirs.state, version: theirs.version, local: side == .server ? theirs.state : nil)
        case .registerGame:
            return
        }
        try markChange(change.id, .pending)
    }
}
