import Foundation
@testable import HockeyCore
import Testing

@Suite("Card recordings")
struct CardRecordingTests {
    private func file(_ name: String, _ folder: String = "100GOPRO", size: Int64 = 100) -> CardFile {
        CardFile(folder: folder, name: name, sizeBytes: size)
    }

    @Test func groupsTheChaptersByFileNumber() {
        let recordings = cardRecordings([
            file("GX020042.MP4", size: 20),
            file("GX010043.MP4", size: 5),
            file("GX010042.MP4", size: 40),
            file("GX010042.THM"),
            file("GL010042.LRV"),
            file("GOPR0044.JPG"),
            file("readme.txt"),
        ])

        #expect(recordings.map(\.id) == ["0042", "0043"])
        #expect(recordings[0].chapters.map(\.name) == ["GX010042.MP4", "GX020042.MP4"])
        #expect(recordings[0].sizeBytes == 60)
        #expect(recordings[0].problem == nil)
        #expect(recordings[1].chapters.map(\.name) == ["GX010043.MP4"])
    }

    @Test func keepsARecordingAcrossCameraFolders() {
        let recordings = cardRecordings([file("GX020042.MP4", "101GOPRO"), file("GX010042.MP4", "100GOPRO")])

        #expect(recordings.map(\.chapters) == [[file("GX010042.MP4", "100GOPRO"), file("GX020042.MP4", "101GOPRO")]])
    }

    @Test func marksARecordingWithAMissingChapter() {
        let recordings = cardRecordings([file("GX010042.MP4"), file("GX030042.MP4"), file("GH010050.MP4")])

        #expect(recordings.map(\.id) == ["0042", "0050"])
        #expect(recordings[0].chapters.isEmpty)
        #expect(recordings[0].problem == .missing(PartLabel(scheme: .gopro, recording: 42, index: 2)))
        #expect(recordings[1].problem == nil)
    }

    @Test func ordersTheChosenRecordingsAsTheGameFolderWill() throws {
        let recordings = cardRecordings([
            file("GX010043.MP4"), file("GX010042.MP4"), file("GX020042.MP4"),
        ])

        let chapters = try importChapters(recordings.reversed()).get()

        #expect(chapters.map(\.name) == ["GX010042.MP4", "GX020042.MP4", "GX010043.MP4"])
        #expect(try importChapters([]).get().isEmpty)
    }

    @Test func refusesMoreChaptersThanAGameMayHave() {
        let recordings = (1...(maxGameParts + 1)).map { number in
            CardRecording(id: String(format: "%04d", number), chapters: [file(String(format: "GX01%04d.MP4", number))], problem: nil)
        }

        #expect(throws: GamePartsProblem.tooManyParts(count: maxGameParts + 1)) { try importChapters(recordings).get() }
    }

    @Test func datesAndNamesTheGameFolderFromTheFirstRecording() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try #require(TimeZone(identifier: "Europe/Berlin"))
        // Half past midnight in Berlin is still the evening before in UTC.
        let startedAt = try #require(ISO8601DateFormatter().date(from: "2026-09-26T22:30:00Z"))

        #expect(playedOn(startedAt: startedAt, calendar: calendar) == "2026-09-27")
        #expect(newGameFolderName(startedAt: startedAt, calendar: calendar, taken: []) == "2026-09-27 00.30")
        #expect(
            newGameFolderName(startedAt: startedAt, calendar: calendar, taken: ["2026-09-27 00.30", "2026-09-27 00.30 2"])
                == "2026-09-27 00.30 3"
        )
    }
}
