import Foundation

/// The library folder the card import copies games into, typically on the
/// external SSD. The coach picks it once; a bookmark finds it again when the
/// disk mounts under another name. It never leaves this Mac.
@MainActor
@Observable
final class LibraryFolder {
    private static let key = "libraryBookmark"

    /// The folder, while it can be found.
    private(set) var url: URL?

    init() {
        guard let data = UserDefaults.standard.data(forKey: Self.key) else { return }
        var isStale = false
        guard let url = try? URL(resolvingBookmarkData: data, bookmarkDataIsStale: &isStale) else { return }
        self.url = url
        if isStale { choose(url) }
    }

    /// Keeps `url` as the library from now on.
    func choose(_ url: URL) {
        self.url = url
        if let data = try? url.bookmarkData() {
            UserDefaults.standard.set(data, forKey: Self.key)
        }
    }
}
