import Foundation
import HockeyStore
@testable import HockeySync
import Testing

@Suite("Three-way merge")
struct MergeTests {
    let base = TagState(type: "goal", startS: 990, endS: 1005)
    let player = UUID()

    @Test func takesEachSidesOwnChanges() {
        var mine = base
        mine.startS = 985
        var theirs = base
        theirs.visibility = .single
        theirs.playerIds = [player]
        let result = merge(base: base, mine: mine, theirs: theirs, fields: TagState.syncFields)
        #expect(result.clashes.isEmpty)
        #expect(result.merged == TagState(type: "goal", startS: 985, endS: 1005, visibility: .single, playerIds: [player]))
    }

    @Test func sameChangeOnBothSidesIsNoClash() {
        var both = base
        both.type = "corner_short"
        let result = merge(base: base, mine: both, theirs: both, fields: TagState.syncFields)
        #expect(result.clashes.isEmpty && result.merged == both)
    }

    @Test func differentChangesToOneFieldWaitForTheCoach() {
        var mine = base
        mine.endS = 1010
        var theirs = base
        theirs.startS = 980
        theirs.type = "action_good"
        let open = merge(base: base, mine: mine, theirs: theirs, fields: TagState.syncFields)
        #expect(open.clashes == [.window])

        let kept = merge(base: base, mine: mine, theirs: theirs, fields: TagState.syncFields, side: .mine)
        #expect(kept.clashes.isEmpty)
        #expect(kept.merged == TagState(type: "action_good", startS: 990, endS: 1010))
        let taken = merge(base: base, mine: mine, theirs: theirs, fields: TagState.syncFields, side: .server)
        #expect(taken.merged == theirs)
    }

    /// The main type and the further types are one field: a main type taken
    /// from one side and further types from the other could hold the same
    /// type twice.
    @Test func typesMergeAsOne() {
        var mine = base
        mine.type = "corner_short"
        var theirs = base
        theirs.extraTypes = ["corner_short"]
        #expect(merge(base: base, mine: mine, theirs: theirs, fields: TagState.syncFields).clashes == [.types])

        var window = base
        window.startS = 985
        let result = merge(base: base, mine: window, theirs: theirs, fields: TagState.syncFields)
        #expect(result.clashes.isEmpty)
        #expect(result.merged == TagState(type: "goal", extraTypes: ["corner_short"], startS: 985, endS: 1005))
    }

    @Test func playersCompareAsASet() {
        let other = UUID()
        let mine = TagState(type: "goal", startS: 990, endS: 1005, visibility: .single, playerIds: [player, other])
        let theirs = TagState(type: "goal", startS: 990, endS: 1005, visibility: .single, playerIds: [other, player])
        #expect(merge(base: base, mine: mine, theirs: theirs, fields: TagState.syncFields).clashes.isEmpty)
    }

    @Test func mergesGameFieldsByField() {
        let base = GameFields(title: "", opponent: nil, playedOn: "2026-09-20")
        let mine = GameFields(title: "Heimspiel", opponent: nil, playedOn: "2026-09-20")
        let theirs = GameFields(title: "", opponent: "TSV Beispiel", playedOn: "2026-09-21")
        let result = merge(base: base, mine: mine, theirs: theirs, fields: GameFields.syncFields)
        #expect(result.clashes.isEmpty)
        #expect(result.merged == GameFields(title: "Heimspiel", opponent: "TSV Beispiel", playedOn: "2026-09-21"))
    }
}
