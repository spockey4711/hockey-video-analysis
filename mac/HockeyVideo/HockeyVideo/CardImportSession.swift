import AppKit
import HockeyCore
import HockeyMedia

/// One import from a camera card, while its sheet is up: the coach picks the
/// game's recordings, the app copies and checks them into a new game folder
/// in the library, opens that game and offers to eject the card.
@MainActor
@Observable
final class CardImportSession: Identifiable {
    enum Phase {
        case choosing
        case copying(ImportProgress?)
        case finished
        case failed(message: String)
    }

    let card: CameraCard
    /// The chosen recordings' file numbers.
    var selection: Set<String>
    private(set) var thumbnails: [String: CGImage] = [:]
    private(set) var phase = Phase.choosing
    private(set) var isEjecting = false
    private(set) var ejected = false
    private(set) var ejectFailed = false

    @ObservationIgnored private var copy: Task<Void, Never>?

    init(card: CameraCard) {
        self.card = card
        // The newest recording is most likely the game just played.
        let importable = card.recordings.filter { $0.recording.problem == nil }
        let newest = importable.max { ($0.startedAt ?? .distantPast) < ($1.startedAt ?? .distantPast) }
        selection = newest.map { [$0.id] } ?? []
    }

    var isBusy: Bool {
        if case .copying = phase { true } else { false }
    }

    /// The chosen recordings in the card's order.
    private var chosen: [CardRecordingMedia] {
        card.recordings.filter { selection.contains($0.id) && $0.recording.problem == nil }
    }

    var chosenBytes: Int64 { chosen.reduce(0) { $0 + $1.recording.sizeBytes } }

    /// Makes the thumbnails, one recording after the other.
    func loadThumbnails() async {
        for recording in card.recordings where recording.recording.problem == nil && thumbnails[recording.id] == nil {
            thumbnails[recording.id] = await recordingThumbnail(recording, maxWidth: 192)
        }
    }

    /// Copies the chosen recordings into a new game folder in `library`, then
    /// hands the folder and the day it was played to `open`.
    func start(library: URL?, open: @escaping @MainActor (URL, String) async -> Void) {
        guard !isBusy, !chosen.isEmpty else { return }
        guard let library, (try? library.checkResourceIsReachable()) == true else {
            phase = .failed(message: String(localized: "import.error.noLibrary"))
            return
        }
        let chapters: [CardFile]
        switch importChapters(chosen.map(\.recording)) {
        case let .success(files): chapters = files
        case let .failure(problem):
            phase = .failed(message: OpenFailure.message(for: problem))
            return
        }
        var urls: [CardFile: URL] = [:]
        for recording in chosen {
            for (file, url) in zip(recording.recording.chapters, recording.chapterURLs) { urls[file] = url }
        }
        let startedAt = chosen.compactMap(\.startedAt).min() ?? Date()
        let folderName = newGameFolderName(startedAt: startedAt, calendar: .current, taken: libraryFolderNames(library))
        let day = playedOn(startedAt: startedAt, calendar: .current)

        phase = .copying(nil)
        copy = Task {
            do throws(CardImportError) {
                let folder = try await copyChapters(chapters.compactMap { urls[$0] }, into: library, folderName: folderName) { progress in
                    Task { @MainActor [weak self] in
                        guard let self, self.isBusy else { return }
                        self.phase = .copying(progress)
                    }
                }
                phase = .finished
                await open(folder, day)
            } catch .cancelled {
                phase = .choosing
            } catch {
                phase = .failed(message: Self.message(for: error))
            }
        }
    }

    func cancelCopy() {
        copy?.cancel()
    }

    /// Back to the list after a failure.
    func retry() {
        phase = .choosing
    }

    /// Ejects the card; the copies are checked, so nothing on it is needed.
    func eject() async {
        isEjecting = true
        ejectFailed = false
        let volume = card.volume
        let result = await Task.detached { Result { try NSWorkspace.shared.unmountAndEjectDevice(at: volume) } }.value
        isEjecting = false
        switch result {
        case .success: ejected = true
        case .failure: ejectFailed = true
        }
    }

    private func libraryFolderNames(_ library: URL) -> Set<String> {
        Set((try? FileManager.default.contentsOfDirectory(atPath: library.path(percentEncoded: false))) ?? [])
    }

    private static func message(for error: CardImportError) -> String {
        switch error {
        case let .noSpace(needed, free):
            String(localized: "import.error.noSpace \(bytes(needed)) \(bytes(free))")
        case .unwritable: String(localized: "import.error.unwritable")
        case let .unreadable(fileName): String(localized: "import.error.unreadable \(fileName)")
        case let .mismatch(fileName): String(localized: "import.error.mismatch \(fileName)")
        case .cancelled: String(localized: "import.error.cancelled")
        }
    }

    static func bytes(_ count: Int64) -> String {
        count.formatted(.byteCount(style: .file))
    }
}
