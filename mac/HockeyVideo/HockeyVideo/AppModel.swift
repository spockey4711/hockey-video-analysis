import Foundation
import HockeyMedia
import Observation

/// What the window shows, and the one action that changes it: opening a folder.
@MainActor
@Observable
final class AppModel {
    enum Screen {
        case empty
        case loading(folderName: String)
        case failed(message: String)
        case playing(GamePlayer)
    }

    private(set) var screen = Screen.empty
    /// Whether the folder picker is up.
    var isChoosingFolder = false

    /// The folder whose files the open game plays, kept accessible while it
    /// plays.
    @ObservationIgnored private var accessedFolder: URL?

    /// Opens a folder the coach picked as the game to play.
    func open(_ folder: URL) async {
        if case let .playing(current) = screen { current.pause() }
        release()
        if folder.startAccessingSecurityScopedResource() { accessedFolder = folder }
        screen = .loading(folderName: folder.lastPathComponent)
        do {
            screen = .playing(try await GamePlayer.open(folder: folder))
        } catch {
            release()
            screen = .failed(message: OpenFailure.message(for: error))
        }
    }

    private func release() {
        accessedFolder?.stopAccessingSecurityScopedResource()
        accessedFolder = nil
    }
}

extension URL {
    /// Whether the URL names a folder on disk, however it was spelt.
    var isFolder: Bool {
        (try? resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true
    }
}
