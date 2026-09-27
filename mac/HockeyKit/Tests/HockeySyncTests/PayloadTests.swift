import Foundation
import HockeyCore
import HockeyStore
@testable import HockeySync
import Testing

/// The server's golden answers in `contracts/api/` (Mac plan S3, S4), written
/// by its route tests: the Swift client must read every one of them.
@Suite("Golden payloads")
struct PayloadTests {
    static let directory = URL(filePath: #filePath)
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .appending(path: "contracts/api")

    private func read<Value: Decodable>(_ name: String, as type: Value.Type) throws -> Value {
        try JSONDecoder.api.decode(type, from: Data(contentsOf: Self.directory.appending(path: "\(name).json")))
    }

    @Test func readsAGameSnapshot() throws {
        let copy = try read("game", as: GameSnapshot.self).copy()
        #expect(copy.fields == GameFields(title: "Heimspiel", opponent: "TSV Beispiel", playedOn: "2026-09-20"))
        #expect((copy.version, copy.revision, copy.quartersVersion) == (3, 42, 5))
        #expect(copy.quarters == [Quarter(index: 1, startS: 12.5, endS: 912.5), Quarter(index: 2, startS: 1030, endS: nil)])
        let goal = try #require(copy.tags.first)
        #expect(goal.state.type == "goal" && goal.state.startS == 990 && goal.state.endS == 1005)
        #expect(goal.state.extraTypes.isEmpty)
        #expect(goal.state.visibility == .single && goal.state.playerIds.count == 2)
        #expect(goal.version == 4)
        #expect(goal.createdAt == Date(timeIntervalSince1970: 1_789_916_645))
        #expect(copy.tags[1].state.endS == nil && copy.tags[1].state.playerIds.isEmpty)
        #expect(copy.tags[1].state.type == "corner_short" && copy.tags[1].state.extraTypes == ["goal"])
    }

    @Test func readsTheRegistrationAndGameAnswers() throws {
        let registered = try read("game-registered", as: GameSnapshot.self).copy()
        #expect(registered.fields.isUnderReview && registered.tags.isEmpty && registered.quarters.isEmpty)
        #expect(try read("game-updated", as: GameEnvelope.self).game.version == 2)
        #expect(try read("game-accepted", as: GameEnvelope.self).game.title == "Heimspiel")
        #expect(try read("game-conflict", as: GameEnvelope.self).game.fields.opponent == "SC Anders")
        #expect(try read("game-not-under-review", as: GameEnvelope.self).game.version == 2)
    }

    @Test func readsTheLibraryRosterAndWindows() throws {
        let library = try read("library", as: LibraryPayload.self)
        #expect(library.games.map(\.revision) == [42, 1] && library.rosterRevision == 9)
        let roster = try read("players", as: RosterPayload.self)
        #expect(roster.players.map(\.jerseyNumber) == [7, nil] && roster.rosterRevision == 9)
        let windows = try read("tag-windows", as: TagWindowsPayload.self).byType
        #expect(windows["goal"] == TagWindow(preS: 15, postS: 5) && windows.count == 4)
    }

    @Test func readsTheTagAndQuarterAnswers() throws {
        let created = try read("tag-created", as: TagEnvelope.self).tag
        #expect(created.version == 1 && created.state.visibility == .team && created.playerIds == nil)
        #expect(created.state.extraTypes.isEmpty)
        let updated = try read("tag-updated", as: TagEnvelope.self).tag.state
        #expect(updated.startS == 988 && updated.extraTypes == ["corner_short"])
        let clash = try read("tag-conflict", as: TagEnvelope.self).tag
        #expect(clash.version == 5 && clash.state.playerIds.count == 1 && clash.state.extraTypes == ["corner_short"])
        let players = try read("tag-players-saved", as: TagPlayersEnvelope.self).tagPlayers
        #expect(players.visibility == .single && players.version == 6)
        #expect(try read("quarters-saved", as: QuartersPayload.self).version == 6)
        #expect(try read("quarters-conflict", as: QuartersPayload.self).quarters.count == 2)
    }

    @Test func readsEveryGoldenFile() throws {
        let files = try FileManager.default.contentsOfDirectory(atPath: Self.directory.path(percentEncoded: false))
        let known: Set = [
            "game", "game-registered", "game-updated", "game-accepted", "game-conflict", "game-not-under-review",
            "library", "players", "tag-windows", "tag-created", "tag-updated", "tag-conflict", "tag-players-saved",
            "quarters-saved", "quarters-conflict",
        ]
        // A new golden answer needs a decode test here.
        #expect(Set(files.map { $0.replacing(".json", with: "") }) == known)
    }

    @Test func writesAGamePatchWithOnlyTheChangedFields() throws {
        let base = GameFields(title: "Heimspiel", opponent: "TSV Beispiel", playedOn: "2026-09-20")
        var local = base
        local.opponent = nil
        let body = try JSONSerialization.jsonObject(with: JSONEncoder().encode(GamePatchBody(from: base, to: local))) as? NSDictionary
        #expect(body == ["opponent": NSNull()])
    }

    @Test func readsATagFromAServerWithoutFurtherTypes() throws {
        let json = #"{"tag":{"type":"goal","startS":988,"endS":null,"visibility":"team","version":5}}"#
        #expect(try JSONDecoder.api.decode(TagEnvelope.self, from: Data(json.utf8)).tag.state.extraTypes.isEmpty)
    }

    @Test func writesATagEditWithFurtherTypesOnlyWhenTheyChanged() throws {
        let base = TagState(type: "goal", extraTypes: ["corner_short"], startS: 990, endS: 1005)
        var local = base
        local.startS = 989
        let windowOnly = try JSONSerialization.jsonObject(with: JSONEncoder().encode(TagEditBody(from: base, to: local))) as? NSDictionary
        #expect(windowOnly == ["type": "goal", "startS": 989, "endS": 1005])
        local.extraTypes = []
        let cleared = try JSONSerialization.jsonObject(with: JSONEncoder().encode(TagEditBody(from: base, to: local))) as? NSDictionary
        #expect(cleared == ["type": "goal", "extraTypes": [String](), "startS": 989, "endS": 1005])
    }

    @Test func acceptsHttpsServersAndLocalTestServersOnly() throws {
        #expect(try serverURL(from: " hockey.example.org/ ").absoluteString == "https://hockey.example.org")
        #expect(try serverURL(from: "https://Hockey.Example.org/app?x=1").absoluteString == "https://hockey.example.org/app")
        #expect(try serverURL(from: "http://localhost:3000").absoluteString == "http://localhost:3000")
        #expect(throws: SyncError.invalidServer) { try serverURL(from: "http://hockey.example.org") }
        #expect(throws: SyncError.invalidServer) { try serverURL(from: "https://user:pw@hockey.example.org") }
        #expect(throws: SyncError.invalidServer) { try serverURL(from: "") }
    }
}
