/// Jump markers: each tag's start as a point on the game timeline, and the
/// next, previous and current marker from the play position (the `,` and `.`
/// keys). They come straight from the tags, so they work before any clip is
/// cut.
///
/// Port of `src/features/player/jump-markers/navigation.ts`, pinned by
/// `contracts/vectors/jump-markers.json`.

/// A marker within this distance of the play position counts as "here", so a
/// press while parked on a marker moves to its neighbour.
public let atMarkerEpsilonS = 0.25

/// A tagged moment as jump navigation needs it.
public struct JumpMarker: Equatable, Sendable, Identifiable {
    /// The tag's id.
    public let id: String
    /// The tag's type key, for the colour.
    public let type: String
    public let startS: Double

    public init(id: String, type: String, startS: Double) {
        self.id = id
        self.type = type
        self.startS = startS
    }
}

/// The markers ordered by start; equal starts keep their order.
public func sortMarkers(_ markers: [JumpMarker]) -> [JumpMarker] {
    markers.enumerated()
        .sorted { lhs, rhs in
            lhs.element.startS != rhs.element.startS
                ? lhs.element.startS < rhs.element.startS : lhs.offset < rhs.offset
        }
        .map(\.element)
}

/// The first marker after the play position, skipping one the play position
/// sits on; `nil` at or past the last.
public func nextMarker(_ markers: [JumpMarker], gameTimeS: Double) -> JumpMarker? {
    guard gameTimeS.isFinite else { return nil }
    return sortMarkers(markers).first { $0.startS > gameTimeS + atMarkerEpsilonS }
}

/// The last marker before the play position, skipping one the play position
/// sits on; `nil` at or before the first.
public func previousMarker(_ markers: [JumpMarker], gameTimeS: Double) -> JumpMarker? {
    guard gameTimeS.isFinite else { return nil }
    return sortMarkers(markers).last { $0.startS < gameTimeS - atMarkerEpsilonS }
}

/// The marker the play position sits on: the nearest within
/// `atMarkerEpsilonS`, the one listed last on a tie.
public func activeMarker(_ markers: [JumpMarker], gameTimeS: Double) -> JumpMarker? {
    guard gameTimeS.isFinite else { return nil }
    var best: JumpMarker?
    var bestDistance = atMarkerEpsilonS
    for marker in markers {
        let distance = abs(marker.startS - gameTimeS)
        if distance <= bestDistance {
            best = marker
            bestDistance = distance
        }
    }
    return best
}

/// A start's place on the timeline in `[0, 1]`; 0 while the game has no
/// length.
public func markerFraction(_ startS: Double, totalDurationS: Double) -> Double {
    guard totalDurationS > 0 else { return 0 }
    let fraction = startS / totalDurationS
    guard fraction.isFinite else { return 0 }
    return min(max(fraction, 0), 1)
}
