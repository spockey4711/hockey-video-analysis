import HockeyCore
import HockeyMedia
import HockeyStore
import SwiftUI

/// The rail next to the picture: the game's tags with the selected tag's
/// detail, or the quarters editor.
struct GameRail: View {
    let player: GamePlayer
    let desk: TaggingDesk

    private enum Tab: Hashable {
        case tags
        case quarters
    }

    @State private var tab = Tab.tags

    var body: some View {
        VStack(spacing: 0) {
            Picker("rail.tab", selection: $tab) {
                Text("rail.tags").tag(Tab.tags)
                Text(PeriodCopy(desk.format).title).tag(Tab.quarters)
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .padding(12)
            Divider()
            // Both stay alive, so switching keeps an unsaved quarter draft.
            ZStack {
                pane(TagsRail(player: player, desk: desk), shown: tab == .tags)
                pane(QuarterEditor(player: player, desk: desk), shown: tab == .quarters)
            }
        }
        .frame(width: 320)
        .background(.background)
    }

    private func pane(_ content: some View, shown: Bool) -> some View {
        content
            .opacity(shown ? 1 : 0)
            .allowsHitTesting(shown)
            .accessibilityHidden(!shown)
    }
}

/// The game's tags by start time; choosing one jumps to it and opens its
/// detail below the list.
private struct TagsRail: View {
    let player: GamePlayer
    let desk: TaggingDesk

    var body: some View {
        VStack(spacing: 0) {
            Text("tags.heading \(desk.tags.count)")
                .font(.headline)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
            if desk.tags.isEmpty {
                ContentUnavailableView {
                    Label("tags.empty.title", systemImage: "tag")
                } description: {
                    Text("tags.empty.hint")
                }
                .frame(maxHeight: .infinity)
            } else {
                ScrollViewReader { scroller in
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            ForEach(desk.tags) { tag in
                                row(tag)
                                    .id(tag.id)
                            }
                        }
                    }
                    .onChange(of: desk.selectedTagID) { _, id in
                        guard let id else { return }
                        withAnimation { scroller.scrollTo(id) }
                    }
                }
            }
            Divider()
            Group {
                if let tag = desk.selectedTag {
                    TagDetail(player: player, desk: desk, tag: tag)
                        .id(tag.id)
                } else {
                    Text("tags.selectHint")
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, minHeight: 60)
                }
            }
            .padding(12)
        }
    }

    /// A button, not a list row, so choosing a tag leaves the keyboard with
    /// the player and its tag keys.
    private func row(_ tag: StoredTag) -> some View {
        let isSelected = tag.id == desk.selectedTagID
        let label = desk.catalog.label(forType: tag.type)
        return Button {
            desk.selectedTagID = tag.id
            player.seek(toS: tag.startS)
        } label: {
            HStack(spacing: 12) {
                Text(verbatim: formatGameClock(tag.startS))
                    .monospacedDigit()
                    .foregroundStyle(isSelected ? .primary : .secondary)
                    .frame(width: 64, alignment: .leading)
                TagChip(catalog: desk.catalog, type: tag.type)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .contentShape(Rectangle())
            .background(isSelected ? Color.accentColor.opacity(0.15) : .clear)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text("tags.select \(label) \(formatGameClock(tag.startS))"))
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}
