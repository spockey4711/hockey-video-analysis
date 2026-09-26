import Foundation
import HockeyCore

/// A game opened from a folder on the Mac: its chapters in play order, each
/// with the duration that places it on the game timeline.
public struct LocalGame: Equatable, Sendable {
    /// The folder the coach picked.
    public let folder: URL
    /// The folder that holds the chapters: the picked one, or a camera card's
    /// `DCIM` folder inside it.
    public let chapterFolder: URL
    public let scheme: PartScheme
    public let chapters: [ChapterMedia]
    /// Files next to the chapters that are not part of the game.
    public let ignored: [String]

    public init(folder: URL, chapterFolder: URL, scheme: PartScheme, chapters: [ChapterMedia], ignored: [String]) {
        self.folder = folder
        self.chapterFolder = chapterFolder
        self.scheme = scheme
        self.chapters = chapters
        self.ignored = ignored
    }

    /// The game's name: the picked folder's name.
    public var title: String { folder.lastPathComponent }

    public var durationsS: [Double] { chapters.map(\.durationS) }

    /// The whole game's length.
    public var totalS: Double { chapters.reduce(0) { $0 + $1.durationS } }

    /// Where the footage jumps to a new recording, as fractions of the game.
    public var breaks: [SourceBreak] {
        sourceBreaks(chapters.map { SourceBreakInput(label: $0.fileName, durationS: $0.durationS) })
    }
}

/// Why a folder cannot be opened as a game.
public enum GameFolderError: Error, Equatable, Sendable {
    /// The folder cannot be listed.
    case unreadable
    /// No file in the folder (or its `DCIM` folders) is a game part.
    case noParts
    /// Parts exist but cannot be ordered into one game.
    case invalid(GamePartsProblem)
    /// A chapter cannot be played.
    case chapter(ChapterProbeError)
}

/// The regular, visible files directly in `folder`.
func listFileNames(in folder: URL) throws -> [String] {
    try FileManager.default.contentsOfDirectory(
        at: folder,
        includingPropertiesForKeys: [.isRegularFileKey],
        options: [.skipsHiddenFiles, .skipsSubdirectoryDescendants]
    )
    .filter { (try? $0.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile) == true }
    .map(\.lastPathComponent)
}

/// The folders to look for chapters in: the picked folder first, then, for a
/// camera card, each folder in its `DCIM` folder (`100GOPRO`), in name order.
func chapterFolderCandidates(for folder: URL) -> [URL] {
    let dcim = folder.appending(path: "DCIM", directoryHint: .isDirectory)
    let cameraFolders = (try? FileManager.default.contentsOfDirectory(
        at: dcim,
        includingPropertiesForKeys: [.isDirectoryKey],
        options: [.skipsHiddenFiles]
    )) ?? []
    return [folder] + cameraFolders
        .filter { (try? $0.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true }
        .sorted { $0.lastPathComponent < $1.lastPathComponent }
}

/// Opens the folder the coach picked as one game: finds its chapters with the
/// shared part rules, then reads each chapter's duration and video timing.
public func openGameFolder(_ folder: URL) async throws(GameFolderError) -> LocalGame {
    var found: (URL, PartScheme, [String], [String])?
    search: for (offset, candidate) in chapterFolderCandidates(for: folder).enumerated() {
        let names: [String]
        do {
            names = try listFileNames(in: candidate)
        } catch {
            // Only the picked folder itself must be readable.
            if offset == 0 { throw .unreadable }
            continue
        }
        switch selectGameParts(names) {
        case let .parts(scheme, parts, ignored):
            found = (candidate, scheme, parts, ignored)
            break search
        case .none:
            continue
        case let .invalid(problem):
            throw .invalid(problem)
        }
    }
    guard let (chapterFolder, scheme, parts, ignored) = found else { throw .noParts }

    let chapters: [ChapterMedia]
    do {
        chapters = try await probeChapters(parts.map { chapterFolder.appending(path: $0) })
    } catch {
        throw .chapter(error)
    }
    return LocalGame(folder: folder, chapterFolder: chapterFolder, scheme: scheme, chapters: chapters, ignored: ignored)
}

/// Probes every chapter at once and returns them in the given order.
func probeChapters(_ urls: [URL]) async throws(ChapterProbeError) -> [ChapterMedia] {
    do {
        return try await withThrowingTaskGroup(of: (Int, ChapterMedia).self) { group in
            for (index, url) in urls.enumerated() {
                group.addTask { (index, try await probeChapter(at: url)) }
            }
            var probed = [ChapterMedia?](repeating: nil, count: urls.count)
            for try await (index, chapter) in group {
                probed[index] = chapter
            }
            return probed.compactMap(\.self)
        }
    } catch let error as ChapterProbeError {
        throw error
    } catch {
        throw .unreadable(fileName: "")
    }
}
