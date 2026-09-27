import SwiftUI

/// The window: an invitation to open a game folder, the game while it loads,
/// why it did not open, or the player.
struct ContentView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        Group {
            switch model.screen {
            case .empty:
                OpenFolderPrompt(
                    title: "empty.title",
                    symbol: "film.stack",
                    message: String(localized: "empty.hint"),
                    action: "app.open"
                )
            case let .loading(folderName):
                ProgressView("loading \(folderName)")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            case let .failed(message):
                OpenFolderPrompt(
                    title: "error.title",
                    symbol: "questionmark.folder",
                    message: message,
                    action: "error.retry"
                )
            case let .playing(player, desk):
                PlayerScreen(player: player, desk: desk)
                    .navigationTitle(desk.game.title)
                    .id(ObjectIdentifier(player))
                    .toolbar {
                        ToolbarItem {
                            Button("game.edit", systemImage: "info.circle") { model.isEditingGame = true }
                                .help(Text("game.edit.help"))
                        }
                    }
                    .sheet(isPresented: $model.isEditingGame) { GameFieldsSheet(desk: desk) }
                    // A sync that brought the browser's changes shows them at once.
                    .onChange(of: model.sync?.pulls) {
                        try? desk.reload()
                        if let windows = model.sync?.tagWindows { desk.windows = windows }
                    }
            }
        }
        .toolbar {
            if let sync = model.sync {
                ToolbarItem(placement: .primaryAction) { SyncBadge(sync: sync) }
            }
        }
        .sheet(isPresented: $model.isSigningIn) {
            if let sync = model.sync { SignInSheet(sync: sync) }
        }
        .sheet(item: $model.cardImport) { CardImportSheet(session: $0) }
        .alert("import.noCard", isPresented: $model.isMissingCard) {} message: {
            Text("import.noCard.hint")
        }
        .frame(minWidth: 980, minHeight: 560)
        .fileImporter(isPresented: $model.isChoosingFolder, allowedContentTypes: [.folder]) { result in
            guard case let .success(folder) = result else { return }
            Task { await model.open(folder) }
        }
        // A game folder or a camera card dragged in from Finder opens too.
        .dropDestination(for: URL.self) { urls, _ in
            guard let folder = urls.first(where: \.isFolder) else { return false }
            Task { await model.open(folder) }
            return true
        }
    }
}

/// A centred message with the button that opens the folder picker.
private struct OpenFolderPrompt: View {
    @Environment(AppModel.self) private var model
    let title: LocalizedStringKey
    let symbol: String
    let message: String
    let action: LocalizedStringKey

    var body: some View {
        ContentUnavailableView {
            Label(title, systemImage: symbol)
        } description: {
            Text(message)
        } actions: {
            Button(action) { model.isChoosingFolder = true }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
        }
    }
}
