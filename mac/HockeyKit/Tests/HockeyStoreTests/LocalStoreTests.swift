import Foundation
import GRDB
import HockeyCore
@testable import HockeyStore
import Testing

/// Three chapters of one recording, as a folder on the SSD holds them.
let chapters = [
    StoredChapter(fileName: "GX010042.MP4", sizeBytes: 4_000_000_000, durationS: 531.531),
    StoredChapter(fileName: "GX020042.MP4", sizeBytes: 4_000_000_000, durationS: 531.531),
    StoredChapter(fileName: "GX030042.MP4", sizeBytes: 1_600_000_000, durationS: 212.345),
]

let catalog = TagTypeCatalog.bundled

@Suite("Local store")
struct LocalStoreTests {
    @Test func createsAGameOnceAndFindsItAgainByItsFiles() throws {
        let store = try LocalStore.inMemory()
        let game = try store.game(chapters: chapters, folderName: "Game A")
        #expect(game.title == "Game A")
        #expect(game.chapters == chapters)
        #expect(game.periodCount == nil && game.periodLengthS == nil)
        #expect(game.format(teamDefault: .standard) == .standard)

        // Renamed folder, re-probed durations: the same files are the same
        // game, and the stored durations stay.
        let reprobed = chapters.map { StoredChapter(fileName: $0.fileName, sizeBytes: $0.sizeBytes, durationS: $0.durationS + 0.001) }
        let again = try store.game(chapters: reprobed, folderName: "Game A renamed")
        #expect(again == game)

        // A different last chapter is a different game.
        var other = chapters
        other[2] = StoredChapter(fileName: "GX030042.MP4", sizeBytes: 1_500_000_000, durationS: 200)
        #expect(try store.game(chapters: other, folderName: "Game A").id != game.id)
        #expect(throws: StoreError.noChapters) { try store.game(chapters: [], folderName: "Empty") }
    }

    @Test func datesAnImportedGameAndMovesAKnownOneToTheLibrary() throws {
        let store = try LocalStore.inMemory()
        let imported = try store.importedGame(chapters: chapters, folderName: "2026-09-27 14.05", playedOn: "2026-09-27")
        #expect(imported.fields == GameFields(title: "", opponent: nil, playedOn: "2026-09-27"))
        #expect(imported.folderName == "2026-09-27 14.05")
        #expect(try store.pendingChanges().map(\.kind) == [.registerGame])

        // Watched from the card first: the same game, now in the library.
        let other = [StoredChapter(fileName: "GX010050.MP4", sizeBytes: 1_000, durationS: 10)]
        let fromCard = try store.game(chapters: other, folderName: "GOPRO")
        let moved = try store.importedGame(chapters: other, folderName: "2026-09-28 10.00", playedOn: "2026-09-28")
        #expect(moved.id == fromCard.id)
        #expect(moved.folderName == "2026-09-28 10.00" && moved.fields.playedOn == "2026-09-28")

        // Once the server has it, its folder is fixed (ADR 0002).
        try store.database.write { db in try db.execute(sql: "UPDATE game SET version = 1") }
        let again = try store.importedGame(chapters: other, folderName: "2026-09-28 10.00 2", playedOn: "2026-09-29")
        #expect(again == moved)
        #expect(throws: StoreError.noChapters) {
            try store.importedGame(chapters: [], folderName: "Empty", playedOn: "2026-09-27")
        }
    }

    @Test func keepsTheGameOnDisk() throws {
        let folder = FileManager.default.temporaryDirectory.appending(path: "store-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: folder) }
        let url = folder.appending(path: "Library.sqlite")

        let game = try LocalStore(url: url).game(chapters: chapters, folderName: "Game A")
        let tag = try LocalStore(url: url).addTag(TagFields(type: "goal", startS: 990, endS: 1005), toGame: game.id, types: catalog)

        let reopened = try LocalStore(url: url)
        #expect(try reopened.game(chapters: chapters, folderName: "Game A") == game)
        #expect(try reopened.tags(ofGame: game.id) == [tag])
    }

    @Test func addsUpdatesAndDeletesTags() throws {
        let store = try LocalStore.inMemory()
        let game = try store.game(chapters: chapters, folderName: "Game A")
        let created = Date(timeIntervalSince1970: 1_000)
        let later = try store.addTag(TagFields(type: "goal", startS: 990, endS: 1005), toGame: game.id, types: catalog, now: created)
        let earlier = try store.addTag(TagFields(type: "action_bad", startS: 12, endS: nil), toGame: game.id, types: catalog, now: created)
        #expect(try store.tags(ofGame: game.id) == [earlier, later])

        let edited = Date(timeIntervalSince1970: 2_000)
        let updated = try store.updateTag(later.id, to: TagFields(type: "corner_short", startS: 5, endS: 20), types: catalog, now: edited)
        #expect(updated.id == later.id)
        #expect(updated.fields == TagFields(type: "corner_short", startS: 5, endS: 20))
        #expect(updated.createdAt == created)
        #expect(updated.updatedAt == edited)
        #expect(try store.tags(ofGame: game.id).map(\.id) == [later.id, earlier.id])

        try store.deleteTag(earlier.id)
        #expect(try store.tags(ofGame: game.id) == [updated])
        #expect(throws: StoreError.notFound) { try store.deleteTag(earlier.id) }
        #expect(throws: StoreError.notFound) {
            try store.updateTag(earlier.id, to: TagFields(type: "goal", startS: 1, endS: nil), types: catalog)
        }
    }

    @Test func refusesTagsTheServerWouldRefuse() throws {
        let store = try LocalStore.inMemory()
        let game = try store.game(chapters: chapters, folderName: "Game A")
        #expect(throws: StoreError.invalidTag(.unknownType)) {
            try store.addTag(TagFields(type: "Tor", startS: 1, endS: nil), toGame: game.id, types: catalog)
        }
        #expect(throws: StoreError.invalidTag(.invalidStart)) {
            try store.addTag(TagFields(type: "goal", startS: -1, endS: nil), toGame: game.id, types: catalog)
        }
        let tag = try store.addTag(TagFields(type: "goal", startS: 10, endS: 20), toGame: game.id, types: catalog)
        #expect(throws: StoreError.invalidTag(.invalidEnd)) {
            try store.updateTag(tag.id, to: TagFields(type: "goal", startS: 10, endS: 10), types: catalog)
        }
        #expect(throws: StoreError.notFound) {
            try store.addTag(TagFields(type: "goal", startS: 1, endS: nil), toGame: UUID(), types: catalog)
        }
        #expect(try store.tags(ofGame: game.id) == [tag])
    }

    @Test func storesFurtherTypesInTheCatalogsOrder() throws {
        let store = try LocalStore.inMemory()
        let game = try store.game(chapters: chapters, folderName: "Game A")
        let fields = TagFields(type: "corner_short", extraTypes: ["action_good", "goal", "corner_short", "goal"], startS: 60, endS: nil)
        let tag = try store.addTag(fields, toGame: game.id, types: catalog)
        #expect(tag.types == TagTypeSet(type: "corner_short", extraTypes: ["goal", "action_good"]))
        #expect(tag.types.keys == ["corner_short", "goal", "action_good"])

        let updated = try store.updateTag(tag.id, to: TagFields(type: "goal", extraTypes: ["goal"], startS: 60, endS: nil), types: catalog)
        #expect(updated.types == TagTypeSet(type: "goal"))
        #expect(try store.tags(ofGame: game.id) == [updated])
        #expect(throws: StoreError.invalidTag(.unknownType)) {
            try store.updateTag(tag.id, to: TagFields(type: "goal", extraTypes: ["Tor"], startS: 60, endS: nil), types: catalog)
        }
    }

    /// A store from before the further types keeps its tags, and pulls every
    /// synced game again to bring in the further types its tags carry.
    @Test func migratesAStoreFromBeforeTheFurtherTypes() throws {
        let database = try DatabaseQueue()
        try storeMigrator.migrate(database, upTo: "v2: sync with the server")
        let gameID = UUID()
        let tagID = UUID()
        try database.write { db in
            try db.execute(
                sql: "INSERT INTO game (id, title, folder_name, created_at, version, revision, sync_off) VALUES (?, '', 'Game A', ?, 1, 7, 0)",
                arguments: [gameID.storedValue, Date()]
            )
            try db.execute(
                sql: "INSERT INTO tag (id, game_id, type, start_s, created_at, updated_at, version, base) VALUES (?, ?, 'goal', 990, ?, ?, 3, ?)",
                arguments: [tagID.storedValue, gameID.storedValue, Date(), Date(), #"{"type":"goal","startS":990,"visibility":"team","playerIds":[]}"#]
            )
        }

        let store = try LocalStore(database)
        #expect(try store.tags(ofGame: gameID).map(\.types) == [TagTypeSet(type: "goal")])
        #expect(try store.tagSync(tagID)?.row.base == TagState(type: "goal", startS: 990, endS: nil))
        #expect(try store.syncedGames().map(\.revision) == [nil])
    }

    @Test func replacesTheQuarterSetAsOne() throws {
        let store = try LocalStore.inMemory()
        let game = try store.game(chapters: chapters, folderName: "Game A")
        let marked = [
            Quarter(index: 2, startS: 700, endS: nil),
            Quarter(index: 1, startS: 20, endS: 600),
        ]
        #expect(try store.replaceQuarters(marked, ofGame: game.id, periodCount: 4) == marked.reversed())
        #expect(try store.quarters(ofGame: game.id) == marked.reversed())

        let one = [Quarter(index: 1, startS: 30, endS: nil)]
        #expect(try store.replaceQuarters(one, ofGame: game.id, periodCount: 4) == one)
        #expect(try store.quarters(ofGame: game.id) == one)

        // A refused set leaves the stored one alone.
        #expect(throws: StoreError.invalidQuarters(.overlap)) {
            try store.replaceQuarters(
                [Quarter(index: 1, startS: 10, endS: 800), Quarter(index: 2, startS: 700, endS: nil)],
                ofGame: game.id,
                periodCount: 4
            )
        }
        #expect(throws: StoreError.invalidQuarters(.count)) { try store.replaceQuarters([], ofGame: game.id, periodCount: 4) }
        #expect(throws: StoreError.invalidQuarters(.count)) {
            let five = (1...5).map { Quarter(index: $0, startS: Double($0) * 100, endS: nil) }
            return try store.replaceQuarters(five, ofGame: game.id, periodCount: 4)
        }
        #expect(throws: StoreError.notFound) { try store.replaceQuarters(one, ofGame: UUID(), periodCount: 4) }
        #expect(try store.quarters(ofGame: game.id) == one)
    }

    @Test func storesIdsAsTheServerWritesThem() throws {
        let store = try LocalStore.inMemory()
        let game = try store.game(chapters: chapters, folderName: "Game A")
        #expect(game.id.storedValue == game.id.uuidString.lowercased())
        #expect(try store.tags(ofGame: UUID()).isEmpty)
    }
}
