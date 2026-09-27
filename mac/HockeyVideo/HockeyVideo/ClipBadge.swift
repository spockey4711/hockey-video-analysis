import HockeyStore
import HockeySync
import SwiftUI

/// The toolbar's clip badge: the clips this Mac cuts from its games' originals
/// and uploads, with the choice to wait while it runs on battery behind it.
struct ClipBadge: View {
    let clips: ClipCenter
    @State private var isShowingPanel = false

    var body: some View {
        Button { isShowingPanel.toggle() } label: {
            Label { Text(title) } icon: { Image(systemName: symbol) }
                .labelStyle(.titleAndIcon)
        }
        .help(Text("clips.badge.help"))
        .popover(isPresented: $isShowingPanel, arrowEdge: .bottom) { ClipPanel(clips: clips) }
    }

    private var title: LocalizedStringKey {
        switch clips.activity {
        case .cutting: return "clips.cutting"
        case let .uploading(_, fraction): return "clips.uploading \(fraction.formatted(.percent.precision(.fractionLength(0))))"
        case .idle: break
        }
        if clips.isPausedOnBattery { return "clips.pausedOnBattery" }
        if clips.waitingCount > 0, clips.missingMediaCount == clips.waitingCount { return "clips.missingMedia" }
        if clips.waitingCount > 0 { return "clips.waiting \(clips.waitingCount)" }
        return "clips.done"
    }

    private var symbol: String {
        switch clips.activity {
        case .cutting: return "scissors"
        case .uploading: return "arrow.up.circle"
        case .idle: break
        }
        if clips.isPausedOnBattery { return "battery.25percent" }
        if clips.waitingCount > 0, clips.missingMediaCount == clips.waitingCount { return "externaldrive.badge.questionmark" }
        return clips.waitingCount > 0 ? "film.stack" : "checkmark.circle"
    }
}

/// Behind the badge: what happens to the clips, and the battery choice.
private struct ClipPanel: View {
    @Bindable var clips: ClipCenter

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("clips.heading").font(.headline)
            Text("clips.hint")
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            if clips.missingMediaCount > 0 {
                Text("clips.missingMedia.hint \(clips.missingMediaCount)")
                    .fixedSize(horizontal: false, vertical: true)
            }
            Divider()
            Toggle("clips.pauseOnBattery", isOn: $clips.pausesOnBattery)
        }
        .padding(16)
        .frame(width: 340)
    }
}

/// How a tag's clip stands, for the tag detail.
enum ClipCopy {
    static func status(_ status: ClipStatus?) -> LocalizedStringKey {
        switch status {
        case nil: "clip.status.none"
        case .pending: "clip.status.pending"
        case .processing: "clip.status.processing"
        case .ready: "clip.status.ready"
        case .failed: "clip.status.failed"
        }
    }
}
