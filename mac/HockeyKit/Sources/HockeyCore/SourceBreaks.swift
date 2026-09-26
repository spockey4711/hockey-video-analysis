/// Where the game timeline crosses from one recording into a genuinely new one.
///
/// Port of `src/features/player/source-breaks.ts`, pinned by
/// `contracts/vectors/source-breaks.json`. A GoPro splits one continuous
/// recording into chapters that play on seamlessly, so chapter seams are never
/// marked; only a new recording is. The chapters of one recording share the
/// trailing file number (`GX01`**`0042`**, `GX02`**`0042`**), a new recording
/// bumps it. A name outside the GoPro scheme yields no id, and an unknown
/// boundary counts as continuous.

/// A recording break, placed on the game timeline.
public struct SourceBreak: Equatable, Sendable {
    /// Left edge as a fraction of the total game length, in `[0, 1]`.
    public let startFraction: Double

    public init(startFraction: Double) {
        self.startFraction = startFraction
    }
}

/// One chapter as the break rule needs it: its file name and duration.
public struct SourceBreakInput: Equatable, Sendable {
    /// Chapter file name, e.g. `GX010042.MP4`; a folder prefix is ignored.
    public let label: String
    public let durationS: Double

    public init(label: String, durationS: Double) {
        self.label = label
        self.durationS = durationS
    }
}

/// The GoPro recording id of a chapter file (the trailing 4-digit file number
/// every chapter of one recording shares), or `nil` for any other name.
public func recordingId(_ label: String) -> String? {
    let name = label.split(omittingEmptySubsequences: false) { $0 == "/" || $0 == "\\" }
        .last.map(String.init) ?? label
    let stem = name.lastIndex(of: ".").map { String(name[..<$0]) } ?? name
    // New-style chapters (`GX010042`) and the first chapter of an older camera
    // (`GOPR0042`), whose later chapters use the `GP01xxxx` form.
    let chapter = #/(?i)(?:GX|GH|GP)[0-9]{2}([0-9]{4})/#
    if let match = try? chapter.wholeMatch(in: stem) { return String(match.1) }
    let first = #/(?i)GOPR([0-9]{4})/#
    if let match = try? first.wholeMatch(in: stem) { return String(match.1) }
    return nil
}

/// Whether `next` starts a new recording that does not continue `previous`.
private func isBreak(_ previous: String, _ next: String) -> Bool {
    guard let before = recordingId(previous), let after = recordingId(next) else {
        return false
    }
    return before != after
}

/// A chapter's width on the timeline: zero for a bad duration.
private func laneWidth(_ durationS: Double) -> Double {
    durationS.isFinite && durationS > 0 ? durationS : 0
}

/// The recording breaks of an ordered chapter list, as fractions of the game
/// length. Empty when the game has no length yet or every chapter continues the
/// one before.
public func sourceBreaks(_ sources: [SourceBreakInput]) -> [SourceBreak] {
    let total = sources.reduce(0.0) { $0 + laneWidth($1.durationS) }
    guard total > 0 else { return [] }

    var breaks: [SourceBreak] = []
    var elapsed = 0.0
    for (index, source) in sources.enumerated() {
        if index > 0, isBreak(sources[index - 1].label, source.label) {
            breaks.append(SourceBreak(startFraction: elapsed / total))
        }
        elapsed += laneWidth(source.durationS)
    }
    return breaks
}
