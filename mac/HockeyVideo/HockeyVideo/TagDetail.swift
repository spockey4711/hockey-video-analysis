import HockeyCore
import HockeyMedia
import HockeyStore
import SwiftUI

/// The selected tag: its types and window, who its clip is for, and editing or
/// deleting it. Editing works on a draft: every type as a toggle (ADR 0016),
/// and each window edge nudged by a second or set to the play position; the
/// player parks on a nudged edge so the coach sees the frame the clip will
/// start or end on.
struct TagDetail: View {
    let player: GamePlayer
    let desk: TaggingDesk
    let tag: StoredTag

    /// The window being edited; `nil` while only showing the tag.
    @State private var draft: TagFields?
    /// The types switched on in the editor.
    @State private var selection: [String] = []
    @State private var isConfirmingDelete = false
    @State private var failure: LocalizedStringKey?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let draft {
                editor(edited(draft))
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
            HStack(alignment: .top) {
                TagChips(catalog: desk.catalog, types: tag.types)
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
                GridRow {
                    Text("tag.players").foregroundStyle(.secondary)
                    playersMenu
                }
                GridRow {
                    Text("tag.visibility").foregroundStyle(.secondary)
                    Picker("tag.visibility", selection: Binding(get: { tag.visibility }, set: { setPlayers(visibility: $0) })) {
                        Text("tag.visibility.team").tag(TagVisibility.team)
                        Text("tag.visibility.single").tag(TagVisibility.single)
                    }
                    .labelsHidden()
                    .fixedSize()
                    .disabled(tag.playerIds.isEmpty)
                    .help(Text("tag.visibility.help"))
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
                        selection = tag.types.keys
                        draft = tag.fields
                    }
                    Spacer()
                    Button("tag.delete", role: .destructive) { isConfirmingDelete = true }
                }
            }
        }
    }

    // MARK: Players

    /// The roster as toggles; the tag's players are ticked.
    private var playersMenu: some View {
        Menu {
            ForEach(desk.players) { player in
                Toggle(isOn: Binding(
                    get: { tag.playerIds.contains(player.id) },
                    set: { isOn in
                        let ids = isOn ? tag.playerIds + [player.id] : tag.playerIds.filter { $0 != player.id }
                        setPlayers(ids)
                    }
                )) {
                    Text(verbatim: player.jerseyNumber.map { "\($0) \(player.name)" } ?? player.name)
                }
            }
            if desk.players.isEmpty {
                Text("tag.players.noRoster")
            }
        } label: {
            Text(tag.playerIds.isEmpty ? "tag.players.none" : "tag.players.count \(tag.playerIds.count)")
        }
        .fixedSize()
    }

    /// A player-specific tag without players goes back to the team.
    private func setPlayers(_ ids: [UUID]? = nil, visibility: TagVisibility? = nil) {
        let ids = ids ?? tag.playerIds
        let visibility = ids.isEmpty ? .team : visibility ?? tag.visibility
        do {
            try desk.setPlayers(tag.id, visibility: visibility, playerIds: ids)
            failure = nil
        } catch {
            failure = "tag.error.save"
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

    /// The draft with the types the selection leaves: the tag's main type
    /// while it is on, else the first type on; the default end follows it.
    private func edited(_ draft: TagFields) -> TagFields {
        var fields = draft
        if let types = desk.catalog.tagTypes(fromSelection: selection, mainType: tag.type) {
            fields.types = types
        }
        return fields
    }

    private func editor(_ fields: TagFields) -> some View {
        let isValid = isValidWindow(fields, windows: desk.windows)
        let endS = effectiveEnd(fields, windows: desk.windows)
        return VStack(alignment: .leading, spacing: 12) {
            typeToggles
            Grid(alignment: .leading, horizontalSpacing: 10, verticalSpacing: 6) {
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
                    .disabled(!isValid || selection.isEmpty)
                Button("tag.cancel") {
                    failure = nil
                    draft = nil
                }
            }
        }
    }

    /// Every type as a toggle in the catalog's order, so one moment can be a
    /// short corner and a goal. Saving waits while none is on.
    private var typeToggles: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("tag.types").foregroundStyle(.secondary)
            ChipFlow {
                ForEach(desk.catalog.types) { type in
                    Toggle(isOn: Binding(
                        get: { selection.contains(type.key) },
                        set: { isOn in
                            selection = isOn ? selection + [type.key] : selection.filter { $0 != type.key }
                        }
                    )) {
                        TagChip(catalog: desk.catalog, type: type.key, isOn: selection.contains(type.key))
                    }
                    .toggleStyle(ChipToggleStyle())
                }
            }
            Text(selection.isEmpty ? "tag.types.none" : "tag.types.hint")
                .font(.callout)
                .foregroundStyle(selection.isEmpty ? .red : .secondary)
                .fixedSize(horizontal: false, vertical: true)
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
        let next = nudgeEdge(edited(draft), edge: edge, deltaS: deltaS, maxS: desk.totalS, windows: desk.windows)
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

/// A type toggle drawn as its chip, filled while on: a button that reads as
/// a checkbox to VoiceOver.
private struct ChipToggleStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button { configuration.isOn.toggle() } label: { configuration.label }
            .buttonStyle(.plain)
            .accessibilityAddTraits(configuration.isOn ? [.isToggle, .isSelected] : .isToggle)
    }
}
