import Foundation
import HockeyCore
import HockeyMedia
import HockeyStore
@testable import HockeySync
import Testing

/// Writes a clip file without reading any footage: an MP4 signature and a
/// run of bytes, and the file start 0.4 s before the window. The media tests
/// cover the real cutter.
final class FakeCutter: ClipCutting, @unchecked Sendable {
    private let lock = NSLock()
    private(set) var plans: [ClipCutPlan] = []
    let sizeBytes: Int

    init(sizeBytes: Int = 25) {
        self.sizeBytes = sizeBytes
    }

    func cut(_ plan: ClipCutPlan, durationsS _: [Double], folder _: URL, to output: URL) async throws -> CutClipFile {
        lock.withLock { plans.append(plan) }
        var bytes = Data([0, 0, 0, 24]) + Data("ftypisom".utf8)
        bytes.append(Data((0..<(sizeBytes - bytes.count)).map { UInt8($0 % 251) }))
        try bytes.write(to: output)
        return CutClipFile(url: output, cutStartS: plan.startS - 0.4, sizeBytes: Int64(bytes.count))
    }

    var cuts: Int { lock.withLock { plans.count } }
}

/// Clips cut on this Mac end to end (Mac plan M6): the browser asks for a
/// clip, the Mac cuts it from its files, uploads it in chunks, resumes a
/// broken upload, and cuts again when the tag's window moved.
@MainActor
@Suite("Clips cut on the Mac")
struct ClipTests {
    let server = FakeServer()
    let store: LocalStore
    let sync: SyncCenter
    let cutter = FakeCutter()
    let game: StoredGame
    let temp: URL
    let clipFolder: URL

    init() throws {
        store = try LocalStore.inMemory()
        game = try store.game(chapters: chapters, folderName: "2026-09-20 Heimspiel")
        sync = SyncCenter(store: store, vault: MemoryVault(), appVersion: "0.1.0", transport: server)
        temp = FileManager.default.temporaryDirectory.appending(path: "ClipTests-\(UUID().uuidString)", directoryHint: .isDirectory)
        clipFolder = temp.appending(path: "Clips", directoryHint: .isDirectory)
        let media = temp.appending(path: "2026-09-20 Heimspiel", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: media, withIntermediateDirectories: true)
        try store.setFolderBookmark(media.bookmarkData(), ofGame: game.id)
    }

    private func clips(onBattery: Bool = false, pauses: Bool = false) -> ClipCenter {
        let center = ClipCenter(store: store, sync: sync, folder: clipFolder, cutter: cutter, isOnBattery: { onBattery }, chunkBytes: 10)
        center.pausesOnBattery = pauses
        return center
    }

    /// A synced tag whose clip the browser asked for, pulled to this Mac.
    private func tagWithClip(startS: Double = 300) async throws -> StoredTag {
        try await sync.signIn(server: "http://localhost:3000", email: "coach@example.org", password: "richtig", deviceName: "Test-Mac")
        let tag = try store.addTag(TagFields(type: "goal", startS: startS, endS: startS + 15), toGame: game.id, types: .bundled)
        await sync.syncNow()
        server.browserCutClip(tag.id)
        await sync.syncNow()
        return tag
    }

    private func serverTag(_ id: UUID) -> FakeServer.Tag {
        server.withLock { $0.tags[id.wire]! }
    }

    @Test func cutsUploadsAndHandsOffAPendingClip() async throws {
        let tag = try await tagWithClip()
        #expect(try store.clipStatuses(ofGame: game.id)[tag.id] == .pending)
        let center = clips()
        #expect(center.waitingCount == 1)

        await center.run()

        #expect(cutter.plans.map(\.startS) == [300])
        #expect(cutter.plans.first?.endS == 315)
        let upload = try #require(server.withLock { $0.uploads.values.first })
        #expect(upload.status == "submitted" && upload.tagVersion == 1)
        #expect(upload.bytes.count == 25 && upload.cutStartS == 299.6)
        // Three chunks of at most ten bytes.
        let chunks = server.withLock { $0.requests }.filter { $0.httpMethod == "PATCH" }
        #expect(chunks.map { $0.value(forHTTPHeaderField: "Upload-Offset") } == ["0", "10", "20"])
        #expect(serverTag(tag.id).clip?.status == "processing")
        #expect(center.waitingCount == 0)
        #expect(try FileManager.default.contentsOfDirectory(atPath: clipFolder.path(percentEncoded: false)).isEmpty)

        server.checkHandedOffFiles()
        await sync.syncNow()
        #expect(try store.clipStatuses(ofGame: game.id)[tag.id] == .ready)
    }

    @Test func resumesABrokenUploadWhereTheServerStands() async throws {
        _ = try await tagWithClip()
        server.withLock { $0.offlineAfterChunks = 2 }
        let center = clips()
        await center.run()
        #expect(server.withLock { $0.uploads.values.first?.bytes.count } == 20)

        server.withLock { $0.isOffline = false }
        await center.run()

        let uploads = server.withLock { $0.uploads }
        #expect(uploads.count == 1)
        #expect(uploads.values.first?.status == "submitted" && uploads.values.first?.bytes.count == 25)
        #expect(cutter.cuts == 1)
        let requests = server.withLock { $0.requests }
        #expect(requests.contains { $0.httpMethod == "HEAD" })
    }

    @Test func cutsAgainWhenTheBrowserTrimmedTheTagMeanwhile() async throws {
        let tag = try await tagWithClip()
        server.withLock { $0.trimBeforeHandOff = (tag.id, 295) }
        let center = clips()
        await center.run()

        // Refused with the tag as it is now: the file and upload are gone, and
        // the clip waits until the new window is on this Mac.
        #expect(server.withLock { $0.uploads.isEmpty })
        #expect(center.waitingCount == 0)
        await sync.syncNow()
        #expect(center.waitingCount == 0)
        center.refresh()
        #expect(center.waitingCount == 1)

        await center.run()
        #expect(cutter.plans.map(\.startS) == [300, 295])
        #expect(server.withLock { $0.uploads.values.first?.tagVersion } == 2)
        #expect(serverTag(tag.id).clip?.status == "processing")
    }

    @Test func handsTheSameFileOffWhenOnlyThePlayersChanged() async throws {
        let tag = try await tagWithClip()
        let center = clips()
        // The players changed in the browser after the Mac's last pull.
        server.browserEditTag(tag.id) { $0.playerIds = [UUID()] }
        await center.run()

        #expect(cutter.cuts == 1)
        #expect(server.withLock { $0.uploads.values.first?.tagVersion } == 2)
        #expect(serverTag(tag.id).clip?.status == "processing")
    }

    @Test func aTrimOnTheMacCutsTheClipAgain() async throws {
        let tag = try await tagWithClip()
        let center = clips()
        await center.run()
        server.checkHandedOffFiles()

        _ = try store.updateTag(tag.id, to: TagFields(type: "goal", startS: 302, endS: 315), types: .bundled)
        // Not before the server has the new window.
        center.refresh()
        #expect(center.waitingCount == 0)
        await sync.syncNow()
        #expect(serverTag(tag.id).clip?.status == "pending")
        center.refresh()
        #expect(center.waitingCount == 1)

        await center.run()
        #expect(cutter.plans.map(\.startS) == [300, 302])
        #expect(serverTag(tag.id).clip?.status == "processing")
    }

    @Test func waitsOnBatteryWhenTheCoachWantsIt() async throws {
        _ = try await tagWithClip()
        let paused = clips(onBattery: true, pauses: true)
        await paused.run()
        #expect(cutter.cuts == 0)
        #expect(paused.isPausedOnBattery)

        await clips(onBattery: true, pauses: false).run()
        #expect(cutter.cuts == 1)
    }

    @Test func waitsForTheDiskWithTheOriginals() async throws {
        _ = try await tagWithClip()
        try FileManager.default.removeItem(at: temp.appending(path: "2026-09-20 Heimspiel"))
        let center = clips()
        await center.run()
        #expect(cutter.cuts == 0)
        #expect(center.missingMediaCount == 1)
        #expect(center.waitingCount == 1)
    }

    @Test func leavesDriveGamesToTheServer() async throws {
        let tag = try await tagWithClip()
        let copy = ServerGameCopy(
            id: game.id, fields: GameFields(title: "", opponent: nil, playedOn: nil), version: 1, revision: 99,
            quarters: [], quartersVersion: 1,
            tags: [ServerTag(id: tag.id, state: try #require(store.tagSync(tag.id)?.row.base), version: 1, createdAt: nil,
                             clip: ServerClip(id: UUID(), status: .pending))],
            mediaHome: .drive
        )
        try store.applyServerCopy(copy)
        #expect(try store.clipJobs().isEmpty)
    }
}
