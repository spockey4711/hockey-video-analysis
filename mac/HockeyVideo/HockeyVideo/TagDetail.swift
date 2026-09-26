import HockeyCore
import HockeyMedia
import HockeyStore
import SwiftUI

/// The selected tag: its type and window, and editing or deleting it. Editing
/// works on a draft: the type, and each window edge nudged by a second or set
/// to the play position; the player parks on a nudged edge so the coach sees
/// the frame the clip will start or end on.
struct TagDetail: View {
    let player: GamePlayer
    let desk: TaggingDesk
    let tag: StoredTag

    /// The fields being edited; `nil` while only showing the tag.
    @State private var draft: TagFields?
    @State private var isConfirmingDelete = false
    @State private var failure: LocalizedStringKey?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let draft {
                editor(draft)
            } else {
                summary
            }
            if let failure {
                Text(failure)
                    .font(.callout)
                    .foregroundStyle(.red)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: Showing

    private var summary: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                TagChip(catalog: desk.catalog, type: tag.type)
                Spacer()
                Button("tag.jump") { player.seek(toS: tag.startS) }
            }
            Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 6) {
                GridRow {
                    Text("tag.start").foregroundStyle(.secondary)
                    clock(tag.startS)
                }
                GridRow {
                    Text("tag.end").foregroundStyle(.secondary)
                    if let endS = tag.endS {
                        clock(endS)
                    } else {
                        Text("tag.defaultWindow").foregroundStyle(.secondary)
                    }
                }
            }
            if isConfirmingDelete {
                Text("tag.confirmDelete")
                HStack {
                    Spacer()
                    Button("tag.cancel") { isConfirmingDelete = false }
                    Button("tag.confirmYes", role: .destructive, action: delete)
                        .buttonStyle(.borderedProminent)
                        .tint(.red)
                }
            } else {
                HStack {
                    Button("tag.edit") {
                        failure = nil
                        draft = tag.fields
                    }
                    Spacer()
                    Button("tag.delete", role: .destructive) { isConfirmingDelete = true }
                }
            }
        }
    }

    private func delete() {
        do {
            try desk.delete(tag.id)
        } catch {
            failure = "tag.error.delete"
            isConfirmingDelete = false
        }
    }

    // MARK: Editing

    private func editor(_ fields: TagFields) -> some View {
        let isValid = isValidWindow(fields, windows: desk.windows)
        let endS = effectiveEnd(fields, windows: desk.windows)
        return VStack(alignment: .leading, spacing: 12) {
            Grid(alignment: .leading, horizontalSpacing: 10, verticalSpacing: 6) {
                GridRow {
                    Text("tag.type").foregroundStyle(.secondary)
                    Picker("tag.type", selection: Binding(get: { fields.type }, set: { draft?.type = $0 })) {
                        ForEach(desk.catalog.types) { type in
                            Text(verbatim: type.label).tag(type.key)
                        }
                    }
                    .labelsHidden()
                    .gridCellColumns(2)
                }
                edgeRow(.start, label: "tag.start", seconds: fields.startS, isDefault: false)
                edgeRow(.end, label: "tag.end", seconds: endS, isDefault: fields.endS == nil)
                GridRow {
                    Text("tag.length").foregroundStyle(.secondary)
                    if isValid {
                        clock(endS - fields.startS)
                    } else {
                        Text(verbatim: "-")
                    }
                    Button("tag.clearEnd") { draft?.endS = nil }
                        .disabled(fields.endS == nil)
                        .gridCellAnchor(.trailing)
                }
            }
            if !isValid {
                Text("tag.invalidWindow")
                    .font(.callout)
                    .foregroundStyle(.red)
            }
            HStack {
                Button("tag.save") { save(fields) }
                    .buttonStyle(.borderedProminent)
                    .disabled(!isValid)
                Button("tag.cancel") {
                    failure = nil
                    draft = nil
                }
            }
        }
    }

    private func edgeRow(
        _ edge: WindowEdge,
        label: LocalizedStringKey,
        seconds: Double,
        isDefault: Bool
    ) -> some View {
        let name = String(localized: edge == .start ? "tag.start" : "tag.end")
        return GridRow {
            Text(label).foregroundStyle(.secondary)
            clock(seconds)
                .foregroundStyle(isDefault ? .secondary : .primary)
                .help(isDefault ? Text("tag.defaultWindowHelp") : Text(verbatim: ""))
            HStack(spacing: 4) {
                Button { nudge(edge, by: -trimStepS) } label: {
                    Label("tag.earlier \(name)", systemImage: "chevron.left").labelStyle(.iconOnly)
                }
                Button("tag.setNow") { setToPlayPosition(edge) }
                    .accessibilityLabel(Text("tag.setNowLabel \(name)"))
                Button { nudge(edge, by: trimStepS) } label: {
                    Label("tag.later \(name)", systemImage: "chevron.right").labelStyle(.iconOnly)
                }
            }
            .gridCellAnchor(.trailing)
        }
    }

    private func nudge(_ edge: WindowEdge, by deltaS: Double) {
        guard let draft else { return }
        let next = nudgeEdge(draft, edge: edge, deltaS: deltaS, maxS: desk.totalS, windows: desk.windows)
        self.draft = next
        player.pause()
        player.seek(toS: edge == .start ? next.startS : effectiveEnd(next, windows: desk.windows))
    }

    private func setToPlayPosition(_ edge: WindowEdge) {
        switch edge {
        case .start: draft?.startS = player.currentTimeS
        case .end: draft?.endS = player.currentTimeS
        }
    }

    private func save(_ fields: TagFields) {
        do {
            try desk.update(tag.id, to: fields)
            failure = nil
            draft = nil
        } catch {
            failure = "tag.error.save"
        }
    }

    private func clock(_ seconds: Double) -> some View {
        Text(verbatim: formatGameClock(seconds)).monospacedDigit()
    }
}
