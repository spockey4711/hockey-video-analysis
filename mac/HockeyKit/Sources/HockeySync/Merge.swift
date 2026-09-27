import Foundation
import HockeyCore
import HockeyStore

/// Merging a row the server refused with `409` (ADR 0013): three states - the
/// base both sides started from, the Mac's and the server's - compared field
/// by field. A field only one side changed takes that side; a field both
/// changed to the same value is no clash; a field both changed differently is
/// the coach's call ("Meine Version" or "Version vom Server"). Nothing is
/// overwritten silently.

/// A field the merge compares as one unit.
public enum SyncFieldName: String, Codable, Equatable, Sendable {
    case type, window, players
    case title, opponent, playedOn
    case quarters
}

/// How the merge reads and writes one field of a state.
struct SyncField<State> {
    let name: SyncFieldName
    let same: (State, State) -> Bool
    let take: (inout State, State) -> Void
}

extension TagState {
    /// The type, the clip window as one (its two edges belong together), and
    /// who the clip is for (visibility and players together, as the server
    /// saves them). Players compare as a set: the order carries no meaning.
    static var syncFields: [SyncField<TagState>] {
        [
            SyncField(name: .type, same: { $0.type == $1.type }, take: { $0.type = $1.type }),
            SyncField(
                name: .window,
                same: { $0.startS == $1.startS && $0.endS == $1.endS },
                take: {
                    $0.startS = $1.startS
                    $0.endS = $1.endS
                }
            ),
            SyncField(
                name: .players,
                same: { $0.visibility == $1.visibility && Set($0.playerIds) == Set($1.playerIds) },
                take: {
                    $0.visibility = $1.visibility
                    $0.playerIds = $1.playerIds
                }
            ),
        ]
    }
}

extension GameFields {
    static var syncFields: [SyncField<GameFields>] {
        [
            SyncField(name: .title, same: { $0.title == $1.title }, take: { $0.title = $1.title }),
            SyncField(name: .opponent, same: { $0.opponent == $1.opponent }, take: { $0.opponent = $1.opponent }),
            SyncField(name: .playedOn, same: { $0.playedOn == $1.playedOn }, take: { $0.playedOn = $1.playedOn }),
        ]
    }
}

/// A quarter set is one field: its quarters only make sense together.
var quarterSetFields: [SyncField<[Quarter]>] { [SyncField(name: .quarters, same: ==, take: { $0 = $1 })] }

/// Which side wins the fields both changed, once the coach chose.
public enum ConflictSide: Sendable {
    case mine
    case server
}

struct MergeResult<State> {
    var merged: State
    /// The fields both sides changed differently, still to be decided.
    var clashes: [SyncFieldName]
}

/// Merges `mine` and `theirs` from `base`; with `side` set, the clashing
/// fields take that side and none remain.
func merge<State>(
    base: State,
    mine: State,
    theirs: State,
    fields: [SyncField<State>],
    side: ConflictSide? = nil
) -> MergeResult<State> {
    var result = MergeResult(merged: theirs, clashes: [])
    for field in fields {
        let mineChanged = !field.same(mine, base)
        let theirsChanged = !field.same(theirs, base)
        guard mineChanged else { continue }
        if !theirsChanged || field.same(mine, theirs) || side == .mine {
            field.take(&result.merged, mine)
        } else if side == nil {
            result.clashes.append(field.name)
        }
    }
    return result
}
