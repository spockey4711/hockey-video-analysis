/// Which files of a game folder are the game, and in which order.
///
/// Port of `src/features/ingest/parts.ts`, pinned by
/// `contracts/vectors/game-parts.json`. Three naming schemes count, matched
/// case-insensitively:
///
/// - `halbzeit<N>`: an exported half (`halbzeit1.mp4`, `Halbzeit 2.mp4`),
/// - `viertel<N>`: an exported quarter (`Viertel1.mp4`),
/// - GoPro chapters `GX<CC><NNNN>.MP4` (HEVC) or `GH<CC><NNNN>.MP4` (H.264):
///   chapter `CC` of recording `NNNN`, ordered by recording, then chapter.
///
/// Everything else is ignored. A folder that mixes schemes, repeats a part,
/// skips a number or holds more parts than a game may have is invalid rather
/// than guessed at.

/// The most parts one game may have (`MAX_SOURCES` on the web).
public let maxGameParts = 100

/// The naming scheme a folder's parts follow.
public enum PartScheme: String, Sendable, Comparable {
    case halbzeit
    case viertel
    case gopro

    public static func < (lhs: PartScheme, rhs: PartScheme) -> Bool {
        lhs.rawValue < rhs.rawValue
    }
}

/// One part a problem is about: a half or quarter number, or a GoPro chapter of
/// a recording.
public struct PartLabel: Equatable, Sendable {
    public let scheme: PartScheme
    /// GoPro recording number; 0 for the exported schemes.
    public let recording: Int
    /// Half, quarter or GoPro chapter number.
    public let index: Int

    public init(scheme: PartScheme, recording: Int, index: Int) {
        self.scheme = scheme
        self.recording = recording
        self.index = index
    }
}

/// Why a folder's parts cannot be ordered into one game.
public enum GamePartsProblem: Equatable, Sendable {
    /// The folder mixes naming schemes (sorted by name).
    case mixedSchemes([PartScheme])
    /// The folder holds more than `maxGameParts` parts.
    case tooManyParts(count: Int)
    /// The same part appears under two file names.
    case repeated(PartLabel, first: String, second: String)
    /// A part the sequence needs is not there.
    case missing(PartLabel)
}

/// What `selectGameParts` found in a folder.
public enum GamePartsResult: Equatable, Sendable {
    /// The folder's parts in play order, plus the files that were ignored.
    case parts(scheme: PartScheme, parts: [String], ignored: [String])
    /// No file in the folder is a game part.
    case none(ignored: [String])
    /// Parts exist but cannot be ordered into one game.
    case invalid(GamePartsProblem)
}

/// One recognised part and the key it sorts by.
private struct Part {
    let name: String
    let label: PartLabel
}

private func parsePart(_ name: String) -> Part? {
    let exported = #/(?i)(halbzeit|viertel)[\s_\-]*([0-9]{1,2})\.(?:mp4|mov)/#
    if let match = try? exported.wholeMatch(in: name),
       let scheme = PartScheme(rawValue: match.1.lowercased()),
       let index = Int(match.2)
    {
        return Part(name: name, label: PartLabel(scheme: scheme, recording: 0, index: index))
    }
    let gopro = #/(?i)G[XH]([0-9]{2})([0-9]{4})\.mp4/#
    if let match = try? gopro.wholeMatch(in: name),
       let chapter = Int(match.1),
       let recording = Int(match.2)
    {
        return Part(
            name: name,
            label: PartLabel(scheme: .gopro, recording: recording, index: chapter)
        )
    }
    return nil
}

/// Orders strings by UTF-16 code units, the order JavaScript's default sort and
/// `<` use, so both apps list names identically.
func codeUnitOrder(_ lhs: String, _ rhs: String) -> Bool {
    lhs.utf16.lexicographicallyPrecedes(rhs.utf16)
}

/// Checks that each recording's numbers run 1, 2, 3, ... without a repeat or a
/// gap, and returns the first problem found.
private func findSequenceProblem(_ sorted: [Part]) -> GamePartsProblem? {
    for (offset, part) in sorted.enumerated() {
        let previous = offset > 0 ? sorted[offset - 1] : nil
        let sameRecording = previous?.label.recording == part.label.recording
        let expected = sameRecording ? (previous?.label.index ?? 0) + 1 : 1
        if sameRecording, let previous, part.label.index == previous.label.index {
            return .repeated(part.label, first: previous.name, second: part.name)
        }
        if part.label.index != expected {
            return .missing(
                PartLabel(scheme: part.label.scheme, recording: part.label.recording, index: expected)
            )
        }
    }
    return nil
}

/// Picks and orders the game parts among the file names of one folder.
public func selectGameParts(_ fileNames: [String]) -> GamePartsResult {
    var parts: [Part] = []
    var ignored: [String] = []
    for name in fileNames {
        if let part = parsePart(name) {
            parts.append(part)
        } else {
            ignored.append(name)
        }
    }
    ignored.sort(by: codeUnitOrder)

    if parts.isEmpty { return .none(ignored: ignored) }

    let schemes = Set(parts.map(\.label.scheme)).sorted()
    if schemes.count > 1 { return .invalid(.mixedSchemes(schemes)) }
    if parts.count > maxGameParts { return .invalid(.tooManyParts(count: parts.count)) }

    // The name breaks ties only so a repeated part is reported the same way
    // whatever order the directory listing came in.
    let sorted = parts.sorted { lhs, rhs in
        if lhs.label.recording != rhs.label.recording {
            return lhs.label.recording < rhs.label.recording
        }
        if lhs.label.index != rhs.label.index { return lhs.label.index < rhs.label.index }
        return codeUnitOrder(lhs.name, rhs.name)
    }
    if let problem = findSequenceProblem(sorted) { return .invalid(problem) }

    return .parts(scheme: schemes[0], parts: sorted.map(\.name), ignored: ignored)
}
