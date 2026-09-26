import Foundation
import HockeyCore
import HockeyStore
import Testing

@MainActor
@Suite("Tagging desk")
struct TaggingDeskTests {
    let store: LocalStore
    let desk: TaggingDesk

    init() throws {
        store = try LocalStore.inMemory()
        desk = try TaggingDesk(store: store, game: store.game(chapters: chapters, folderName: "Game A"))
    }

    private func type(_ key: String) throws -> TagType {
        try #require(catalog.type(forKey: key))
    }

    @Test func capturesWithTheTypesWindowClampedToTheGame() throws {
        let goal = try desk.capture(type("goal"), atS: 1000)
        #expect(goal.fields == TagFields(type: "goal", startS: 990, endS: 1005))

        let atEnd = try desk.capture(type("goal"), atS: 5000)
        #expect(atEnd.endS == desk.totalS)
        #expect(desk.tags.map(\.id) == [goal.id, atEnd.id])
        #expect(throws: TagCaptureError.timeOutOfRange) { try desk.capture(type("goal"), atS: -1) }
    }

    @Test func capturesWithAWindowOtherThanTheDefault() throws {
        let windows = TagWindows(["goal": TagWindow(preS: 3, postS: 2)])
        let custom = try TaggingDesk(store: store, game: desk.game, windows: windows)
        #expect(try custom.capture(type("goal"), atS: 100).fields == TagFields(type: "goal", startS: 97, endS: 102))
        #expect(throws: StoreError.invalidTag(.unknownType)) { try custom.capture(type("corner_short"), atS: 100) }
    }

    @Test func editsAndDeletesTheSelectedTag() throws {
        let tag = try desk.capture(type("action_good"), atS: 300)
        desk.selectedTagID = tag.id
        let edited = try desk.update(tag.id, to: TagFields(type: "action_bad", startS: 290, endS: nil))
        #expect(desk.selectedTag == edited)

        try desk.delete(tag.id)
        #expect(desk.tags.isEmpty)
        #expect(desk.selectedTagID == nil)
    }

    @Test func jumpsBetweenTheTagsStarts() throws {
        let first = try desk.capture(type("goal"), atS: 110)
        let second = try desk.capture(type("goal"), atS: 510)
        #expect(desk.nextMarker(from: 0)?.id == first.id.uuidString)
        #expect(desk.nextMarker(from: first.startS)?.id == second.id.uuidString)
        #expect(desk.previousMarker(from: second.startS)?.id == first.id.uuidString)
        #expect(desk.previousMarker(from: first.startS) == nil)
    }

    @Test func playsTheTeamsFormatUnlessTheGameHasItsOwn() throws {
        let halves = GameFormat(periodCount: 2, periodLengthS: 20 * 60)
        let indoor = try TaggingDesk(store: store, game: desk.game, teamFormat: halves)
        #expect(desk.format == .standard)
        #expect(indoor.format == halves)
        try indoor.saveQuarters([Quarter(index: 1, startS: 10, endS: 500), Quarter(index: 2, startS: 600, endS: nil)])
        #expect(indoor.quarterClockS(at: 610) == 20 * 60 + 10)
        #expect(throws: StoreError.invalidQuarters(.count)) {
            try indoor.saveQuarters((1...3).map { Quarter(index: $0, startS: Double($0) * 100, endS: nil) })
        }
    }

    @Test func readsTheQuarterClockInTheGamesPeriodLength() throws {
        try desk.saveQuarters([
            Quarter(index: 1, startS: 20, endS: 400),
            Quarter(index: 2, startS: 500, endS: nil),
        ])
        #expect(desk.quarters.count == 2)
        #expect(desk.quarterClockS(at: 30) == 10)
        #expect(desk.quarterClockS(at: 510) == desk.format.periodLengthS + 10)
        #expect(desk.quarterClockS(at: 450) == 450)
        #expect(desk.breakSkipTargetS(at: 450) == 500)
        #expect(desk.breakSkipTargetS(at: 510) == nil)

        // The desk reads what was stored, and a refused set changes nothing.
        let reopened = try TaggingDesk(store: store, game: desk.game)
        #expect(reopened.quarters == desk.quarters)
        #expect(throws: StoreError.invalidQuarters(.notContiguous)) {
            try desk.saveQuarters([Quarter(index: 2, startS: 20, endS: nil)])
        }
        #expect(desk.quarters.count == 2)
    }
}
