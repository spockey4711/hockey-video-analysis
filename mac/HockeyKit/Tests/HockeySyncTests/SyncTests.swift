import Foundation
import HockeyCore
import HockeyStore
@testable import HockeySync
import Testing

let chapters = [
    StoredChapter(fileName: "GX010042.MP4", sizeBytes: 4_000_000_000, durationS: 531.531),
    StoredChapter(fileName: "GX020042.MP4", sizeBytes: 1_600_000_000, durationS: 212.345),
]

/// The sync end to end against a server in memory: the Mac tags offline,
/// signs in, pushes, and pulls what the browser changed meanwhile.
@MainActor
@Suite("Sync")
struct SyncTests {
    let server = FakeServer()
    let vault = MemoryVault()
    let store: LocalStore
    let center: SyncCenter
    let game: StoredGame

    init() throws {
        store = try LocalStore.inMemory()
        game = try store.game(chapters: chapters, folderName: "2026-09-20 Heimspiel")
        center = SyncCenter(store: store, vault: vault, appVersion: "0.1.0", transport: server)
    }

    private func signIn() async throws {
        try await center.signIn(server: "http://localhost:3000", email: "coach@example.org", password: "richtig", deviceName: "Test-Mac")
    }

    private func addTag(_ startS: Double = 990) throws -> StoredTag {
        try store.addTag(TagFields(type: "goal", startS: startS, endS: startS + 15), toGame: game.id, types: .bundled)
    }

    @Test func tagsOfflineAndPushesEverythingOnSignIn() async throws {
        let tag = try addTag()
        let player = try #require(UUID(uuidString: "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d"))
        _ = try store.setTagPlayers(tag.id, visibility: .single, playerIds: [player])
        _ = try store.replaceQuarters([Quarter(index: 1, startS: 20, endS: 900)], ofGame: game.id, periodCount: 4)
        center.refresh()
        #expect(center.unsyncedCount == 4)
        #expect(center.status == .signedOut)

        try await signIn()
        #expect(center.status == .synced)
        #expect(center.unsyncedCount == 0)
        #expect(vault.saved?.token == server.token)
        server.withLock { server in
            #expect(server.games[game.id.wire]?.fields.isUnderReview == true)
            #expect(server.tags[tag.id.wire]?.state == TagState(type: "goal", startS: 990, endS: 1005, visibility: .single, playerIds: [player]))
            #expect(server.games[game.id.wire]?.quarters.count == 1)
        }
        // The roster and the team's windows came along.
        #expect(try store.players().map(\.name) == ["Spielerin A"])
        #expect(center.tagWindows?["goal"] == TagWindow(preS: 12, postS: 3))
        #expect(center.tagWindows?["corner_short"] != nil)

        // Every request named the build and carried the token; writes their base.
        let requests = server.withLock { $0.requests }
        #expect(requests.allSatisfy { $0.value(forHTTPHeaderField: "X-HVA-App-Version") == "0.1.0" })
        #expect(requests.dropFirst().allSatisfy { $0.value(forHTTPHeaderField: "Authorization") == "Bearer \(server.token)" })
        #expect(requests.contains { $0.httpMethod == "PUT" && $0.value(forHTTPHeaderField: "If-Match") == "\"1\"" })
    }

    @Test func pullsWhatTheBrowserChanged() async throws {
        let kept = try addTag(100)
        let gone = try addTag(200)
        try await signIn()

        server.browserEditTag(kept.id) { $0.type = "action_good" }
        server.browserDeleteTag(gone.id)
        let added = UUID()
        server.browserAddTag(added, game: game.id, state: TagState(type: "action_bad", startS: 300, endS: nil))
        server.browserEditGame(game.id) { $0.opponent = "TSV Beispiel" }
        let before = center.pulls
        await center.syncNow()

        #expect(center.pulls == before + 1)
        #expect(try store.tags(ofGame: game.id).map(\.id) == [kept.id, added])
        #expect(try store.tags(ofGame: game.id).first?.type == "action_good")
        #expect(try store.game(id: game.id).fields.opponent == "TSV Beispiel")
        #expect(center.unsyncedCount == 0)
    }

    @Test func mergesDifferentFieldsWithoutAsking() async throws {
        let tag = try addTag()
        try await signIn()

        server.browserEditTag(tag.id) { $0.type = "corner_short" }
        _ = try store.updateTag(tag.id, to: TagFields(type: "goal", startS: 985, endS: 1005), types: .bundled)
        await center.syncNow()

        #expect(center.conflicts.isEmpty && center.unsyncedCount == 0)
        let merged = TagState(type: "corner_short", startS: 985, endS: 1005)
        #expect(try store.tags(ofGame: game.id).first?.state == merged)
        server.withLock { #expect($0.tags[tag.id.wire]?.state == merged) }
    }

    @Test func asksWhenTheSameFieldChangedOnBothSides() async throws {
        let tag = try addTag()
        try await signIn()

        server.browserEditTag(tag.id) { $0.startS = 980 }
        _ = try store.updateTag(tag.id, to: TagFields(type: "goal", startS: 985, endS: 1005), types: .bundled)
        await center.syncNow()

        let conflict = try #require(center.conflicts.first)
        #expect(conflict.fields == [.window])
        #expect(center.unsyncedCount == 1)
        guard case let .tag(mine, theirs) = conflict.sides else { Issue.record("not a tag conflict"); return }
        #expect(mine?.startS == 985 && theirs.startS == 980)

        center.resolve(conflict, side: .mine)
        await center.syncNow()
        #expect(center.conflicts.isEmpty && center.unsyncedCount == 0)
        server.withLock { #expect($0.tags[tag.id.wire]?.state.startS == 985) }
    }

    @Test func takesTheServersVersionWhenTheCoachSaysSo() async throws {
        _ = try store.replaceQuarters([Quarter(index: 1, startS: 20, endS: 900)], ofGame: game.id, periodCount: 4)
        try await signIn()
        let tag = try addTag()
        await center.syncNow()

        server.browserEditTag(tag.id) { $0.endS = 1010 }
        try store.deleteTag(tag.id)
        await center.syncNow()
        let conflict = try #require(center.conflicts.first)
        #expect(conflict.change.kind == .deleteTag)

        center.resolve(conflict, side: .server)
        await center.syncNow()
        #expect(center.conflicts.isEmpty && center.unsyncedCount == 0)
        #expect(try store.tags(ofGame: game.id).map(\.endS) == [1010])
    }

    @Test func syncsFurtherTypesBothWays() async throws {
        let tag = try store.addTag(
            TagFields(type: "corner_short", extraTypes: ["goal"], startS: 60, endS: nil),
            toGame: game.id,
            types: .bundled
        )
        try await signIn()
        server.withLock { #expect($0.tags[tag.id.wire]?.state.extraTypes == ["goal"]) }

        _ = try store.updateTag(tag.id, to: TagFields(type: "goal", startS: 60, endS: nil), types: .bundled)
        await center.syncNow()
        server.withLock { #expect($0.tags[tag.id.wire]?.state.fields == TagFields(type: "goal", startS: 60, endS: nil)) }

        server.browserEditTag(tag.id) { $0.extraTypes = ["action_good"] }
        await center.syncNow()
        #expect(try store.tags(ofGame: game.id).first?.types == TagTypeSet(type: "goal", extraTypes: ["action_good"]))
        #expect(center.unsyncedCount == 0)
    }

    /// Further types the Mac never read (a build from before them pulled the
    /// tag) survive an edit of the window, and come back to the Mac with it.
    @Test func neverDropsFurtherTypesItHasNotSeen() async throws {
        let tag = try addTag()
        try await signIn()
        server.browserEditTag(tag.id, keepingVersion: true) { $0.extraTypes = ["corner_short"] }

        _ = try store.updateTag(tag.id, to: TagFields(type: "goal", startS: 985, endS: 1005), types: .bundled)
        await center.syncNow()

        let kept = TagState(type: "goal", extraTypes: ["corner_short"], startS: 985, endS: 1005)
        server.withLock { #expect($0.tags[tag.id.wire]?.state == kept) }
        #expect(try store.tags(ofGame: game.id).first?.state == kept)
        #expect(center.conflicts.isEmpty && center.unsyncedCount == 0)
    }

    @Test func mergesAFurtherTypeAddedInTheBrowser() async throws {
        let tag = try addTag()
        try await signIn()

        server.browserEditTag(tag.id) { $0.extraTypes = ["corner_short"] }
        _ = try store.updateTag(tag.id, to: TagFields(type: "goal", startS: 985, endS: 1005), types: .bundled)
        await center.syncNow()

        #expect(center.conflicts.isEmpty && center.unsyncedCount == 0)
        let merged = TagState(type: "goal", extraTypes: ["corner_short"], startS: 985, endS: 1005)
        #expect(try store.tags(ofGame: game.id).first?.state == merged)
        server.withLock { #expect($0.tags[tag.id.wire]?.state == merged) }
    }

    @Test func asksWhenBothSidesChangedTheTypes() async throws {
        let tag = try addTag()
        try await signIn()

        server.browserEditTag(tag.id) { $0.extraTypes = ["action_good"] }
        _ = try store.updateTag(tag.id, to: TagFields(type: "goal", extraTypes: ["corner_short"], startS: 990, endS: 1005), types: .bundled)
        await center.syncNow()

        let conflict = try #require(center.conflicts.first)
        #expect(conflict.fields == [.types])
        center.resolve(conflict, side: .server)
        await center.syncNow()
        #expect(center.conflicts.isEmpty && center.unsyncedCount == 0)
        #expect(try store.tags(ofGame: game.id).first?.extraTypes == ["action_good"])
        server.withLock { #expect($0.tags[tag.id.wire]?.state.extraTypes == ["action_good"]) }
    }

    @Test func keepsChangesWhileOfflineAndSendsThemOnReconnect() async throws {
        try await signIn()
        server.withLock { $0.isOffline = true }
        let tag = try addTag()
        await center.syncNow()
        #expect(center.status == .offline)
        #expect(center.unsyncedCount == 1)

        server.withLock { $0.isOffline = false }
        await center.syncNow()
        #expect(center.status == .synced && center.unsyncedCount == 0)
        server.withLock { #expect($0.tags[tag.id.wire] != nil) }
    }

    @Test func retriesACreateWithoutMakingItTwice() async throws {
        try await signIn()
        let tag = try addTag()
        await center.syncNow()
        // The answer got lost: the Mac sends the same create again.
        let retry = try await APIClient(server: #require(center.server), token: server.token, appVersion: "0.1.0", transport: server)
            .send(
                "POST",
                "api/tags",
                body: TagCreateBody(id: tag.id.wire, gameId: game.id.wire, type: "goal", extraTypes: [], startS: 990, endS: 1005)
            )
        #expect(retry.status == 201)
        server.withLock { #expect($0.tags.count == 1) }
    }

    @Test func stopsForAnUpdateOrARevokedDevice() async throws {
        try await signIn()
        server.withLock { $0.minVersion = "0.2.0" }
        await center.syncNow()
        #expect(center.status == .updateRequired(minVersion: "0.2.0"))

        let other = SyncCenter(store: store, vault: vault, appVersion: "0.1.0", transport: server)
        server.withLock {
            $0.minVersion = nil
            $0.revokedToken = true
        }
        await other.syncNow()
        #expect(other.status == .signedOutByServer)
        #expect(vault.saved == nil && other.server == nil)
    }

    @Test func refusesAWrongPassword() async throws {
        await #expect(throws: SyncError.unauthorized) {
            try await center.signIn(server: "http://localhost:3000", email: "coach@example.org", password: "falsch", deviceName: "Test-Mac")
        }
        #expect(vault.saved == nil && center.status == .signedOut)
    }

    @Test func signsOut() async throws {
        try await signIn()
        await center.signOut()
        #expect(center.status == .signedOut && vault.saved == nil)
        server.withLock { #expect($0.requests.last?.httpMethod == "DELETE") }
    }
}
