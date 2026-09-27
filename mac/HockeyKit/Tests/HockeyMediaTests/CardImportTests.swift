import CryptoKit
import Foundation
import HockeyCore
@testable import HockeyMedia
import Testing

/// A synthetic camera card: generated chapters under GoPro names in
/// `DCIM/100GOPRO`, next to the companion files a camera writes.
private func makeCard(in temp: TemporaryFolder) async throws -> URL {
    let card = try temp.folder("CARD")
    let camera = try temp.folder("CARD/DCIM/100GOPRO")
    _ = try temp.folder("CARD/MISC")
    try await SyntheticChapter.write(to: camera.appending(path: "GX010042.MP4"), frames: 50, fps: 25)
    try await SyntheticChapter.write(to: camera.appending(path: "GX020042.MP4"), frames: 25, fps: 25)
    try await SyntheticChapter.write(to: camera.appending(path: "GX010043.MP4"), frames: 10, fps: 25)
    try Data("thumbnail".utf8).write(to: camera.appending(path: "GX010042.THM"))
    try Data("low resolution".utf8).write(to: camera.appending(path: "GL010042.LRV"))
    // The second recording's chapter is missing: it lists, but cannot be imported.
    try await SyntheticChapter.write(to: camera.appending(path: "GX020044.MP4"), frames: 5, fps: 25)
    let startedAt = Date(timeIntervalSince1970: 1_790_000_000)
    try FileManager.default.setAttributes(
        [.creationDate: startedAt],
        ofItemAtPath: camera.appending(path: "GX010042.MP4").path(percentEncoded: false)
    )
    return card
}

/// Collects progress reports from the copy's thread.
private final class Reports: @unchecked Sendable {
    private let lock = NSLock()
    private var reports: [ImportProgress] = []
    func add(_ report: ImportProgress) { lock.withLock { reports.append(report) } }
    var all: [ImportProgress] { lock.withLock { reports } }
}

@Suite("Card import")
struct CardImportTests {
    @Test func listsTheRecordingsOfACard() async throws {
        let temp = try TemporaryFolder()
        let card = try #require(await readCameraCard(try await makeCard(in: temp)))

        #expect(card.name == "CARD")
        #expect(card.recordings.map(\.id) == ["0042", "0043", "0044"])
        let first = card.recordings[0]
        #expect(first.chapterURLs.map(\.lastPathComponent) == ["GX010042.MP4", "GX020042.MP4"])
        #expect(first.startedAt == Date(timeIntervalSince1970: 1_790_000_000))
        #expect(((first.durationS ?? 0) * 25).rounded() == 75)
        #expect(card.recordings[2].recording.problem == .missing(PartLabel(scheme: .gopro, recording: 44, index: 1)))
        #expect(card.recordings[2].durationS == nil)

        let thumbnail = try #require(await recordingThumbnail(first, maxWidth: 80))
        #expect(thumbnail.width == 80)
    }

    @Test func isNoCardWithoutRecordings() async throws {
        let temp = try TemporaryFolder()
        let disk = try temp.folder("SSD")
        _ = try temp.folder("SSD/DCIM/100GOPRO")
        try Data("notes".utf8).write(to: disk.appending(path: "notes.txt"))

        #expect(await readCameraCard(disk) == nil)
    }

    @Test func copiesTheChosenRecordingsIntoANewGameFolder() async throws {
        let temp = try TemporaryFolder()
        let card = try #require(await readCameraCard(try await makeCard(in: temp)))
        let library = try temp.folder("Library")
        let chapters = card.recordings[0].chapterURLs + card.recordings[1].chapterURLs
        let reports = Reports()

        let folder = try await copyChapters(chapters, into: library, folderName: "2026-09-21 16.13") { reports.add($0) }

        #expect(folder.lastPathComponent == "2026-09-21 16.13")
        let names = try FileManager.default.contentsOfDirectory(atPath: folder.path(percentEncoded: false)).sorted()
        #expect(names == ["GX010042.MP4", "GX010043.MP4", "GX020042.MP4"])
        for chapter in chapters {
            #expect(try Data(contentsOf: folder.appending(path: chapter.lastPathComponent)) == Data(contentsOf: chapter))
        }
        // The copy keeps the camera's date, which dates the game.
        let copied = try folder.appending(path: "GX010042.MP4").resourceValues(forKeys: [.creationDateKey])
        #expect(copied.creationDate == Date(timeIntervalSince1970: 1_790_000_000))
        let last = try #require(reports.all.last)
        #expect(last.step == .verifying && last.fileIndex == 2 && last.fileCount == 3)
        #expect(last.copiedBytes == last.totalBytes && last.checkedBytes == last.totalBytes)
        #expect(last.fraction == 1)
        let firstCheck = try #require(reports.all.first { $0.step == .verifying })
        #expect(firstCheck.copiedBytes < firstCheck.totalBytes && firstCheck.fraction < 1)

        // The folder opens as the game, in the part rules' order.
        let game = try await openGameFolder(folder)
        #expect(game.chapters.map(\.fileName) == ["GX010042.MP4", "GX020042.MP4", "GX010043.MP4"])
    }

    @Test func neverWritesIntoAnExistingFolder() async throws {
        let temp = try TemporaryFolder()
        let card = try #require(await readCameraCard(try await makeCard(in: temp)))
        let library = try temp.folder("Library")
        _ = try temp.folder("Library/Game")

        await #expect(throws: CardImportError.unwritable) {
            try await copyChapters(card.recordings[0].chapterURLs, into: library, folderName: "Game") { _ in }
        }
    }

    @Test func leavesNothingBehindWhenCancelled() async throws {
        let temp = try TemporaryFolder()
        let card = try #require(await readCameraCard(try await makeCard(in: temp)))
        let library = try temp.folder("Library")
        var copiedOnce = false

        #expect(throws: CardImportError.cancelled) {
            try copyChaptersNow(
                card.recordings[0].chapterURLs,
                into: library,
                folderName: "Game",
                isCancelled: { copiedOnce },
                progress: { _ in copiedOnce = true }
            )
        }
        #expect(try FileManager.default.contentsOfDirectory(atPath: library.path(percentEncoded: false)).isEmpty)
    }

    @Test func refusesACopyThatDiffersFromTheOriginal() throws {
        let temp = try TemporaryFolder()
        let copy = temp.url.appending(path: "copy.MP4")
        try Data("original".utf8).write(to: copy)
        let digest = SHA256.hash(data: Data("original".utf8))
        let other = SHA256.hash(data: Data("0riginal".utf8))

        try checkCopy(copy, name: "GX010042.MP4", sizeBytes: 8, digest: digest, isCancelled: { false }, onBytes: { _ in })
        #expect(throws: CardImportError.mismatch(fileName: "GX010042.MP4")) {
            try checkCopy(copy, name: "GX010042.MP4", sizeBytes: 8, digest: other, isCancelled: { false }, onBytes: { _ in })
        }
        #expect(throws: CardImportError.mismatch(fileName: "GX010042.MP4")) {
            try checkCopy(copy, name: "GX010042.MP4", sizeBytes: 9, digest: digest, isCancelled: { false }, onBytes: { _ in })
        }
    }

    @Test func refusesALibraryWithoutRoom() async throws {
        let temp = try TemporaryFolder()
        let library = try temp.folder("Library")
        // A sparse file larger than any disk's free space, without its bytes.
        let huge = temp.url.appending(path: "GX010042.MP4")
        try Data().write(to: huge)
        let handle = try FileHandle(forWritingTo: huge)
        try handle.truncate(atOffset: 1 << 50)
        try handle.close()

        await #expect {
            try await copyChapters([huge], into: library, folderName: "Game") { _ in }
        } throws: { error in
            guard case let .noSpace(needed, _) = error as? CardImportError else { return false }
            return needed == 1 << 50
        }
        #expect(try FileManager.default.contentsOfDirectory(atPath: library.path(percentEncoded: false)).isEmpty)
    }
}
