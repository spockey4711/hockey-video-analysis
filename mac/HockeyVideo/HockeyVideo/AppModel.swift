import Foundation
import HockeyMedia
import HockeyStore
import HockeySync
import Observation

/// What the window shows, and the one action that changes it: opening a folder.
/// It also owns the local store and the sync with the server.
@MainActor
@Observable
final class AppModel {
    enum Screen {
        case empty
        case loading(folderName: String)
        case failed(message: String)
        case playing(GamePlayer, TaggingDesk)
    }

    private(set) var screen = Screen.empty
    /// Whether the folder picker is up.
    var isChoosingFolder = false
    /// Whether the game's title, opponent and date are being edited.
    var isEditingGame = false
    /// Whether the sign-in sheet is up.
    var isSigningIn = false

    /// The folder whose files the open game plays, kept accessible while it
    /// plays.
    @ObservationIgnored private var accessedFolder: URL?
    /// The local store, opened at launch or at the latest with the first game.
    @ObservationIgnored private var store: LocalStore?
    /// The link to the server; `nil` while the store cannot be opened.
    private(set) var sync: SyncCenter?

    init() {
        guard let store = try? openStore() else { return }
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0"
        sync = SyncCenter(store: store, vault: KeychainVault(), appVersion: version)
    }

    /// Opens a folder the coach picked as the game to play and tag. The game
    /// is found again in the local store by its chapter files, so its tags
    /// and quarters come back, and its stored durations place the chapters.
    func open(_ folder: URL) async {
        if case let .playing(current, _) = screen { current.pause() }
        release()
        if folder.startAccessingSecurityScopedResource() { accessedFolder = folder }
        screen = .loading(folderName: folder.lastPathComponent)
        do {
            let game = try await openGameFolder(folder)
            let desk = try makeDesk(for: game, folderName: folder.lastPathComponent)
            let player = try await GamePlayer.open(game.placing(durationsS: desk.game.durationsS))
            screen = .playing(player, desk)
        } catch {
            release()
            screen = .failed(message: OpenFailure.message(for: error))
        }
    }

    private func release() {
        accessedFolder?.stopAccessingSecurityScopedResource()
        accessedFolder = nil
    }

    /// The tagging desk of a game read from its folder, from the local store.
    private func makeDesk(for game: LocalGame, folderName: String) throws(StoreFailure) -> TaggingDesk {
        do {
            let store = try openStore()
            let stored = try store.game(
                chapters: game.chapters.map {
                    StoredChapter(fileName: $0.fileName, sizeBytes: $0.sizeBytes, durationS: $0.durationS)
                },
                folderName: folderName
            )
            let desk = try TaggingDesk(store: store, game: stored, windows: sync?.tagWindows)
            desk.onChange = { [weak self] in self?.sync?.noteChange() }
            sync?.noteChange()
            return desk
        } catch {
            throw StoreFailure(underlying: error)
        }
    }

    /// The store in the app's Application Support folder.
    private func openStore() throws -> LocalStore {
        if let store { return store }
        let support = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let folder = support.appending(path: Bundle.main.bundleIdentifier ?? "HockeyVideo", directoryHint: .isDirectory)
        let opened = try LocalStore(url: folder.appending(path: "Library.sqlite"))
        store = opened
        return opened
    }
}

extension URL {
    /// Whether the URL names a folder on disk, however it was spelt.
    var isFolder: Bool {
        (try? resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true
    }
}
