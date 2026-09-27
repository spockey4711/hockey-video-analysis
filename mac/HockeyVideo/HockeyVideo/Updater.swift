import Combine
import Foundation
import HockeyCore
import Observation
import Sparkle
import SwiftUI

/// Keeps the app up to date through Sparkle (ADR 0013, D7): once a day it reads
/// the appcast on this repository's GitHub releases and installs updates whose
/// EdDSA signature matches the key in `Info.plist`. The feed, the key and the
/// daily check are `Info.plist` settings; `docs/ops/mac-release.md` covers how
/// a release gets there.
///
/// A build without a real update key (every build before the key pair exists)
/// leaves the updater off, so "Nach Updates suchen" stays disabled instead of
/// Sparkle failing at every launch.
@MainActor
@Observable
final class Updater {
    /// Whether a check can start now: false while one runs or an update is
    /// being installed, and always false with the updater off.
    private(set) var canCheckForUpdates = false

    @ObservationIgnored private let controller = SPUStandardUpdaterController(
        startingUpdater: false, updaterDelegate: nil, userDriverDelegate: nil
    )
    @ObservationIgnored private var canCheckSubscription: AnyCancellable?

    init(bundle: Bundle = .main) {
        let key = bundle.object(forInfoDictionaryKey: "SUPublicEDKey") as? String
        guard UpdateKey.isUsable(key) else { return }
        controller.startUpdater()
        canCheckSubscription = controller.updater.publisher(for: \.canCheckForUpdates)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] canCheck in self?.canCheckForUpdates = canCheck }
    }

    /// Checks now and shows the result, even when no update is available.
    func checkForUpdates() {
        controller.checkForUpdates(nil)
    }
}

/// "Nach Updates suchen" in the app menu.
struct CheckForUpdatesButton: View {
    let updater: Updater

    var body: some View {
        Button("app.checkForUpdates") { updater.checkForUpdates() }
            .disabled(!updater.canCheckForUpdates)
    }
}
