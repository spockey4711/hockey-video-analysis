import Foundation
import GRDB
import HockeyCore
@testable import HockeyStore
import Testing

/// Every write queues its change for the server in the same transaction.
@Suite("Outbox")
struct OutboxTests {
    let store: LocalStore
    let game: StoredGame

    init() throws {
        store = try LocalStore.inMemory()
        game = try store.game(chapters: chapters, folderName: "Game A")
    }

    private func kinds() throws -> [ChangeKind] {
        try store.pendingChanges().map(\.kind)
    }

    @Test func queuesEachWriteOncePerRow() throws {
        #expect(try kinds() == [.registerGame])
        #expect(game.fields.isUnderReview && game.title == "Game A")

        let tag = try store.addTag(TagFields(type: "goal", startS: 990, endS: 1005), toGame: game.id, types: catalog)
        _ = try store.updateTag(tag.id, to: TagFields(type: "goal", startS: 985, endS: 1005), types: catalog)
        _ = try store.updateTag(tag.id, to: TagFields(type: "goal", startS: 980, endS: 1005), types: catalog)
        _ = try store.setTagPlayers(tag.id, visibility: .team, playerIds: [])
        _ = try store.replaceQuarters([Quarter(index: 1, startS: 20, endS: nil)], ofGame: game.id, periodCount: 4)
        _ = try store.updateGameFields(game.id, to: GameFields(title: "Heimspiel", opponent: nil, playedOn: "2026-09-20"))
        #expect(try kinds() == [.registerGame, .createTag, .updateTag, .tagPlayers, .replaceQuarters, .gameFields])
        #expect(try store.game(id: game.id).title == "Heimspiel")
    }

    @Test func deletesATagTheServerNeverSawWithoutAWord() throws {
        let tag = try store.addTag(TagFields(type: "goal", startS: 990, endS: nil), toGame: game.id, types: catalog)
        _ = try store.setTagPlayers(tag.id, visibility: .team, playerIds: [])
        try store.deleteTag(tag.id)
        #expect(try kinds() == [.registerGame])
    }

    @Test func deletesATagTheServerHasFromItsVersion() throws {
        let tag = try store.addTag(TagFields(type: "goal", startS: 990, endS: nil), toGame: game.id, types: catalog)
        try store.settleTag(tag.id, ofGame: game.id, base: tag.state, version: 4)
        _ = try store.updateTag(tag.id, to: TagFields(type: "goal", startS: 980, endS: nil), types: catalog)
        try store.deleteTag(tag.id)
        let delete = try #require(store.pendingChanges().last)
        #expect(delete.kind == .deleteTag && delete.baseVersion == 4)
        #expect(try kinds() == [.registerGame, .deleteTag])
    }

    @Test func refusesAPlayerTagWithoutPlayersAndANamedGameWithoutADate() throws {
        let tag = try store.addTag(TagFields(type: "goal", startS: 990, endS: nil), toGame: game.id, types: catalog)
        #expect(throws: StoreError.noPlayers) { try store.setTagPlayers(tag.id, visibility: .single, playerIds: []) }
        #expect(throws: StoreError.invalidGameFields) {
            try store.updateGameFields(game.id, to: GameFields(title: "Heimspiel", opponent: nil, playedOn: nil))
        }
    }

    @Test func pullKeepsRowsWithUnsentChanges() throws {
        let tag = try store.addTag(TagFields(type: "goal", startS: 990, endS: nil), toGame: game.id, types: catalog)
        try store.settleRegistration(ServerGameCopy(
            id: game.id, fields: game.fields, version: 1, revision: 1, quarters: [], quartersVersion: 1, tags: []
        ))
        let server = TagState(type: "corner_short", startS: 990, endS: nil)
        let copy = ServerGameCopy(
            id: game.id, fields: GameFields(title: "", opponent: "TSV Beispiel", playedOn: nil), version: 2, revision: 5,
            quarters: [], quartersVersion: 1, tags: [ServerTag(id: tag.id, state: server, version: 1, createdAt: nil)]
        )
        #expect(try store.applyServerCopy(copy))
        // The unsent create keeps the Mac's tag; the game's fields come in.
        #expect(try store.tags(ofGame: game.id).map(\.type) == ["goal"])
        #expect(try store.game(id: game.id).fields.opponent == "TSV Beispiel")
        #expect(try store.syncedGames().first?.revision == 5)
    }

    @Test func queuesTheGamesTaggedBeforeSyncOnMigration() throws {
        let queue = try DatabaseQueue()
        let gameID = UUID().storedValue
        let tagID = UUID().storedValue
        try storeMigrator.migrate(queue, upTo: "v1: local games, tags and quarters")
        try queue.write { db in
            try db.execute(sql: "INSERT INTO game (id, title, folder_name, created_at) VALUES (?, 'Game A', 'Game A', 0)", arguments: [gameID])
            try db.execute(sql: """
                INSERT INTO tag (id, game_id, type, start_s, created_at, updated_at) VALUES (?, ?, 'goal', 1, 0, 0)
                """, arguments: [tagID, gameID])
            try db.execute(sql: "INSERT INTO quarter (game_id, quarter_index, start_s) VALUES (?, 1, 0)", arguments: [gameID])
        }
        let store = try LocalStore(queue)
        #expect(try store.pendingChanges().map(\.kind) == [.registerGame, .createTag, .replaceQuarters])
        let title = try queue.read { db in try String.fetchOne(db, sql: "SELECT title FROM game") }
        #expect(title == "")
    }
}
