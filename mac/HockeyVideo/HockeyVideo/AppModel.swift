import AppKit
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
    /// The camera card import whose sheet is up.
    var cardImport: CardImportSession?
    /// Whether "Von Karte importieren" found no card.
    var isMissingCard = false
    /// The folder the card import copies games into.
    let library = LibraryFolder()

    /// The folder whose files the open game plays, kept accessible while it
    /// plays.
    @ObservationIgnored private var accessedFolder: URL?
    /// The local store, opened at launch or at the latest with the first game.
    @ObservationIgnored private var store: LocalStore?
    @ObservationIgnored private var volumeObservers: [any NSObjectProtocol] = []
    /// The link to the server; `nil` while the store cannot be opened.
    private(set) var sync: SyncCenter?
    /// The clips this Mac cuts and uploads for its games.
    private(set) var clips: ClipCenter?

    init() {
        guard let store = try? openStore(), let folder = try? supportFolder() else { return }
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0"
        let sync = SyncCenter(store: store, vault: KeychainVault(), appVersion: version)
        let clips = ClipCenter(store: store, sync: sync, folder: folder.appending(path: "Clips", directoryHint: .isDirectory))
        sync.onSynced = { [weak clips] in clips?.kick() }
        self.sync = sync
        self.clips = clips
    }

    /// Opens a folder the coach picked as the game to play and tag. The game
    /// is found again in the local store by its chapter files, so its tags
    /// and quarters come back, and its stored durations place the chapters.
    /// A folder the card import just made is dated with the day it was played.
    func open(_ folder: URL, importedOn playedOn: String? = nil) async {
        if case let .playing(current, _) = screen { current.pause() }
        release()
        if folder.startAccessingSecurityScopedResource() { accessedFolder = folder }
        screen = .loading(folderName: folder.lastPathComponent)
        do {
            let game = try await openGameFolder(folder)
            let desk = try makeDesk(for: game, folderName: folder.lastPathComponent, importedOn: playedOn)
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
    private func makeDesk(for game: LocalGame, folderName: String, importedOn playedOn: String?) throws(StoreFailure) -> TaggingDesk {
        do {
            let store = try openStore()
            let chapters = game.chapters.map {
                StoredChapter(fileName: $0.fileName, sizeBytes: $0.sizeBytes, durationS: $0.durationS)
            }
            let stored = if let playedOn {
                try store.importedGame(chapters: chapters, folderName: folderName, playedOn: playedOn)
            } else {
                try store.game(chapters: chapters, folderName: folderName)
            }
            // Where its clips are cut from, also while another game plays.
            if let bookmark = try? game.chapterFolder.bookmarkData() {
                try store.setFolderBookmark(bookmark, ofGame: stored.id)
            }
            let desk = try TaggingDesk(store: store, game: stored, windows: sync?.tagWindows)
            desk.onChange = { [weak self] in self?.sync?.noteChange() }
            sync?.noteChange()
            return desk
        } catch {
            throw StoreFailure(underlying: error)
        }
    }

    // MARK: Camera cards

    /// Offers to import a card that is already in, then every card put in
    /// later; a card taken out closes its import while the coach is choosing.
    func watchCards() {
        let center = NSWorkspace.shared.notificationCenter
        volumeObservers = [
            center.addObserver(forName: NSWorkspace.didMountNotification, object: nil, queue: .main) { [weak self] note in
                guard let volume = note.userInfo?[NSWorkspace.volumeURLUserInfoKey] as? URL else { return }
                Task { @MainActor in await self?.notice(volume) }
            },
            center.addObserver(forName: NSWorkspace.didUnmountNotification, object: nil, queue: .main) { [weak self] note in
                guard let volume = note.userInfo?[NSWorkspace.volumeURLUserInfoKey] as? URL else { return }
                Task { @MainActor in self?.forget(volume) }
            },
        ]
        Task { await importFromCard(quietly: true) }
    }

    /// Looks for a camera card among the mounted disks and offers the first;
    /// says so when there is none, unless `quietly`.
    func importFromCard(quietly: Bool = false) async {
        guard cardImport == nil else { return }
        let volumes = FileManager.default.mountedVolumeURLs(includingResourceValuesForKeys: nil, options: [.skipHiddenVolumes]) ?? []
        for volume in volumes where volume.path(percentEncoded: false) != "/" {
            if await notice(volume) { return }
        }
        if !quietly { isMissingCard = true }
    }

    /// Offers to import the disk at `volume` if it is a camera card and no
    /// other import is up; whether it is.
    @discardableResult
    private func notice(_ volume: URL) async -> Bool {
        guard cardImport == nil, let card = await readCameraCard(volume) else { return false }
        if cardImport == nil { cardImport = CardImportSession(card: card) }
        return true
    }

    private func forget(_ volume: URL) {
        guard let session = cardImport, session.card.volume.standardizedFileURL == volume.standardizedFileURL,
              !session.isBusy, !session.ejected
        else { return }
        if case .choosing = session.phase { cardImport = nil }
    }

    /// The store in the app's Application Support folder.
    private func openStore() throws -> LocalStore {
        if let store { return store }
        let opened = try LocalStore(url: supportFolder().appending(path: "Library.sqlite"))
        store = opened
        return opened
    }

    /// The app's folder in Application Support: the store, and the clips
    /// waiting for their upload.
    private func supportFolder() throws -> URL {
        let support = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        return support.appending(path: Bundle.main.bundleIdentifier ?? "HockeyVideo", directoryHint: .isDirectory)
    }
}

extension URL {
    /// Whether the URL names a folder on disk, however it was spelt.
    var isFolder: Bool {
        (try? resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true
    }
}
