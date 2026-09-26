import HockeyCore
import HockeyStore
import HockeySync
import SwiftUI

/// The toolbar's sync badge: how the Mac stands with the server, with the
/// account, the conflicts and the refused changes behind it.
struct SyncBadge: View {
    let sync: SyncCenter
    @State private var isShowingPanel = false
    @Environment(AppModel.self) private var model

    var body: some View {
        Button { isShowingPanel.toggle() } label: {
            Label { Text(title) } icon: { Image(systemName: symbol).foregroundStyle(tint) }
                .labelStyle(.titleAndIcon)
        }
        .help(Text("sync.badge.help"))
        .popover(isPresented: $isShowingPanel, arrowEdge: .bottom) {
            SyncPanel(sync: sync) {
                isShowingPanel = false
                model.isSigningIn = true
            }
        }
    }

    private var title: LocalizedStringKey {
        if case .updateRequired = sync.status { return "sync.updateRequired" }
        if !sync.conflicts.isEmpty { return "sync.conflicts \(sync.conflicts.count)" }
        if sync.status == .signedOutByServer { return "sync.signedOutByServer" }
        if sync.unsyncedCount > 0 { return "sync.unsynced \(sync.unsyncedCount)" }
        return switch sync.status {
        case .signedOut: "sync.signedOut"
        case .syncing: "sync.syncing"
        case .offline: "sync.offline"
        case .failed: "sync.failed"
        default: "sync.synced"
        }
    }

    private var symbol: String {
        switch sync.status {
        case .updateRequired, .failed: "exclamationmark.triangle"
        case .signedOut, .signedOutByServer: "person.crop.circle.badge.xmark"
        case .offline: "icloud.slash"
        case .syncing: "arrow.triangle.2.circlepath"
        case .synced: sync.unsyncedCount > 0 || !sync.conflicts.isEmpty ? "arrow.triangle.2.circlepath" : "checkmark.icloud"
        }
    }

    private var tint: Color {
        if case .updateRequired = sync.status { return .red }
        if !sync.conflicts.isEmpty || sync.status == .signedOutByServer || sync.status == .failed { return .orange }
        return .secondary
    }
}

/// Behind the badge: the account, then what waits on the coach.
private struct SyncPanel: View {
    let sync: SyncCenter
    /// Opens the sign-in sheet on the window, not on the popover.
    let signIn: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            account
            if case .updateRequired = sync.status {
                Text("sync.updateRequired.hint").foregroundStyle(.secondary)
            }
            if !sync.conflicts.isEmpty {
                Divider()
                Text("sync.conflicts.heading").font(.headline)
                ForEach(sync.conflicts) { ConflictCard(sync: sync, conflict: $0) }
            }
            if !sync.failures.isEmpty {
                Divider()
                Text("sync.failures.heading").font(.headline)
                ForEach(sync.failures) { failure in
                    HStack(alignment: .firstTextBaseline) {
                        VStack(alignment: .leading) {
                            Text(ChangeCopy.kind(failure.kind))
                            Text(ChangeCopy.failure(failure.failure)).font(.callout).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button("sync.drop") { sync.drop(failure) }
                    }
                }
            }
        }
        .padding(16)
        .frame(width: 380)
    }

    @ViewBuilder private var account: some View {
        if let server = sync.server {
            Text("sync.signedInTo \(server.host() ?? server.absoluteString)")
            HStack {
                Button("sync.now") { Task { await sync.syncNow() } }
                    .disabled(sync.status == .syncing)
                Spacer()
                Button("sync.signOut") { Task { await sync.signOut() } }
            }
        } else {
            Text(sync.status == .signedOutByServer ? "sync.signedOutByServer.hint" : "sync.signedOut.hint")
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            Button("sync.signIn", action: signIn)
                .buttonStyle(.borderedProminent)
        }
    }
}

/// A change the browser clashed with: both sides, and the coach's pick.
private struct ConflictCard: View {
    let sync: SyncCenter
    let conflict: Conflict
    private let catalog = TagTypeCatalog.bundled

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(heading).font(.subheadline.weight(.semibold))
            Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 4) {
                GridRow {
                    Text("sync.conflict.mine").foregroundStyle(.secondary)
                    Text(verbatim: mine)
                }
                GridRow {
                    Text("sync.conflict.server").foregroundStyle(.secondary)
                    Text(verbatim: theirs)
                }
            }
            .font(.callout)
            HStack {
                Button("sync.conflict.keepMine") { sync.resolve(conflict, side: .mine) }
                Button("sync.conflict.takeServer") { sync.resolve(conflict, side: .server) }
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 8))
    }

    private var heading: String {
        switch conflict.sides {
        case let .tag(_, server):
            String(localized: "sync.conflict.tag \(catalog.label(forType: server.type)) \(formatGameClock(server.startS))")
        case .game: String(localized: "sync.conflict.game")
        case .quarters: String(localized: "sync.conflict.quarters")
        }
    }

    private var mine: String {
        switch conflict.sides {
        case let .tag(mine, _): mine.map(describe) ?? String(localized: "sync.conflict.deleted")
        case let .game(mine, _): describe(mine)
        case let .quarters(mine, _): describe(mine)
        }
    }

    private var theirs: String {
        switch conflict.sides {
        case let .tag(_, server): describe(server)
        case let .game(_, server): describe(server)
        case let .quarters(_, server): describe(server)
        }
    }

    /// The clashing fields of a tag; all of them when the Mac deleted it.
    private func describe(_ tag: TagState) -> String {
        let fields = conflict.fields.isEmpty ? [.type, .window] : conflict.fields
        return fields.map { field in
            switch field {
            case .type: catalog.label(forType: tag.type)
            case .window: "\(formatGameClock(tag.startS))-\(tag.endS.map(formatGameClock) ?? "…")"
            case .players: String(localized: "sync.conflict.players \(tag.playerIds.count)")
            default: ""
            }
        }
        .joined(separator: ", ")
    }

    private func describe(_ game: GameFields) -> String {
        conflict.fields.map { field in
            switch field {
            case .title: game.title.isEmpty ? String(localized: "game.underReview") : game.title
            case .opponent: game.opponent ?? "-"
            case .playedOn: game.playedOn ?? "-"
            default: ""
            }
        }
        .joined(separator: ", ")
    }

    private func describe(_ quarters: [Quarter]) -> String {
        quarters.map { "\($0.index): \(formatGameClock($0.startS))" }.joined(separator: ", ")
    }
}

/// How a queued change and a refusal read for the coach.
enum ChangeCopy {
    static func kind(_ kind: ChangeKind) -> LocalizedStringKey {
        switch kind {
        case .registerGame: "change.registerGame"
        case .gameFields: "change.gameFields"
        case .createTag: "change.createTag"
        case .updateTag: "change.updateTag"
        case .tagPlayers: "change.tagPlayers"
        case .deleteTag: "change.deleteTag"
        case .replaceQuarters: "change.replaceQuarters"
        }
    }

    static func failure(_ raw: String?) -> LocalizedStringKey {
        switch raw.flatMap(ChangeFailure.init(rawValue:)) {
        case .folderTaken: "change.failure.folderTaken"
        case .idTaken: "change.failure.idTaken"
        default: "change.failure.refused"
        }
    }
}
