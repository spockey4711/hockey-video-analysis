import Foundation

/// What a camera card holds, and how a chosen set of its recordings becomes a
/// new game folder in the library (ADR 0013, card import). A GoPro splits one
/// recording into chapters that share its file number (`GX01`**`0042`**,
/// `GX02`**`0042`**); the card import lists recordings, not chapters. Built on
/// the part rules and the recording ids, so a card reads the way a game folder
/// does.

/// A file in one of a card's camera folders (`DCIM/100GOPRO`).
public struct CardFile: Equatable, Hashable, Sendable {
    /// The camera folder's name.
    public let folder: String
    public let name: String
    public let sizeBytes: Int64

    public init(folder: String, name: String, sizeBytes: Int64) {
        self.folder = folder
        self.name = name
        self.sizeBytes = sizeBytes
    }
}

/// One recording on a card: its chapters in play order, or why they cannot be
/// played as one.
public struct CardRecording: Equatable, Sendable, Identifiable {
    /// The GoPro file number every chapter carries, `0042`.
    public let id: String
    /// The chapters in play order; empty when the recording has a problem.
    public let chapters: [CardFile]
    /// A chapter is missing or repeated, so the recording cannot be imported.
    public let problem: GamePartsProblem?

    public init(id: String, chapters: [CardFile], problem: GamePartsProblem?) {
        self.id = id
        self.chapters = chapters
        self.problem = problem
    }

    public var sizeBytes: Int64 { chapters.reduce(0) { $0 + $1.sizeBytes } }
}

/// Groups a card's files into recordings by their GoPro file number, each
/// ordered by the part rules, by file number. Files the part rules do not take
/// (the camera's `.THM` and `.LRV` companions, photos) are left out.
public func cardRecordings(_ files: [CardFile]) -> [CardRecording] {
    var groups: [String: [CardFile]] = [:]
    for file in files {
        guard let id = recordingId(file.name) else { continue }
        groups[id, default: []].append(file)
    }
    return groups.compactMap { id, files -> CardRecording? in
        switch selectGameParts(files.map(\.name)) {
        case let .parts(_, parts, _):
            let byName = Dictionary(files.map { ($0.name, $0) }, uniquingKeysWith: { first, _ in first })
            return CardRecording(id: id, chapters: parts.compactMap { byName[$0] }, problem: nil)
        case .none:
            return nil
        case let .invalid(problem):
            return CardRecording(id: id, chapters: [], problem: problem)
        }
    }
    .sorted { codeUnitOrder($0.id, $1.id) }
}

/// A problem is the failure of `importChapters`.
extension GamePartsProblem: Error {}

/// The chapters of the chosen recordings in the order the game folder will
/// play them, checked by the part rules as one folder.
public func importChapters(_ recordings: [CardRecording]) -> Result<[CardFile], GamePartsProblem> {
    let files = recordings.flatMap(\.chapters)
    switch selectGameParts(files.map(\.name)) {
    case let .parts(_, parts, _):
        let byName = Dictionary(files.map { ($0.name, $0) }, uniquingKeysWith: { first, _ in first })
        return .success(parts.compactMap { byName[$0] })
    case .none:
        return .success([])
    case let .invalid(problem):
        return .failure(problem)
    }
}

/// The day a game was played, `YYYY-MM-DD`, from when its first recording
/// started, in the calendar's time zone.
public func playedOn(startedAt: Date, calendar: Calendar) -> String {
    let day = calendar.dateComponents([.year, .month, .day], from: startedAt)
    return String(format: "%04d-%02d-%02d", day.year ?? 0, day.month ?? 0, day.day ?? 0)
}

/// The name of a new game folder in the library: when the game started,
/// `2026-09-27 14.05`, then ` 2`, ` 3` while a folder of that name exists
/// (compared without case, as the Mac's disks do). The name is a valid path
/// segment for the server's chapter paths: no slash, colon or leading dot.
public func newGameFolderName(startedAt: Date, calendar: Calendar, taken: Set<String>) -> String {
    let time = calendar.dateComponents([.hour, .minute], from: startedAt)
    let base = playedOn(startedAt: startedAt, calendar: calendar)
        + String(format: " %02d.%02d", time.hour ?? 0, time.minute ?? 0)
    let takenNames = Set(taken.map { $0.lowercased() })
    var name = base
    var number = 1
    while takenNames.contains(name.lowercased()) {
        number += 1
        name = "\(base) \(number)"
    }
    return name
}
