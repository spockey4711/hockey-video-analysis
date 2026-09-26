import AppKit
import SwiftUI

/// The coach's editing desk on the Mac (ADR 0013). This slice plays a game
/// folder from the SSD or a camera card; all logic lives in `HockeyKit`, and
/// this target holds only views and their copy.
@main
struct HockeyVideoApp: App {
    @NSApplicationDelegateAdaptor private var appDelegate: AppDelegate

    var body: some Scene {
        Window("app.title", id: "player") {
            ContentView()
                .environment(appDelegate.model)
        }
        .defaultSize(width: 1280, height: 800)
        .windowResizability(.contentMinSize)
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("app.open") { appDelegate.model.isChoosingFolder = true }
                    .keyboardShortcut("o")
            }
        }
    }
}

/// Owns the app's state, so a folder handed to the app from outside (Finder,
/// `open -a`) reaches the same window as one picked inside it.
final class AppDelegate: NSObject, NSApplicationDelegate {
    let model = AppModel()

    func application(_: NSApplication, open urls: [URL]) {
        guard let folder = urls.first(where: \.isFolder) else { return }
        Task { await model.open(folder) }
    }

    /// One window, one game: closing it quits, like a document-less player.
    func applicationShouldTerminateAfterLastWindowClosed(_: NSApplication) -> Bool {
        true
    }
}
