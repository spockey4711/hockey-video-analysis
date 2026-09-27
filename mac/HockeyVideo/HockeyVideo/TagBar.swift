import HockeyCore
import HockeyStore
import SwiftUI

/// The tag buttons under the transport, one per type with its key, and the
/// jumps to the previous and next marker (`,` and `.`).
struct TagBar: View {
    let desk: TaggingDesk
    let capture: (TagType) -> Void
    let jumpToMarker: (_ forward: Bool) -> Void

    var body: some View {
        HStack(spacing: 10) {
            ForEach(desk.catalog.types) { type in
                Button { capture(type) } label: {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(desk.catalog.color(forType: type.key))
                            .frame(width: 8, height: 8)
                        Text(verbatim: type.label)
                        Text(verbatim: type.hotkey.uppercased())
                            .font(.caption.monospaced())
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 4)
                            .background(.quaternary, in: RoundedRectangle(cornerRadius: 3))
                    }
                }
                .help(Text("tagbar.help \(type.label) \(type.hotkey.uppercased())"))
            }

            Spacer()

            Text("tagbar.markers \(desk.tags.count)")
                .foregroundStyle(.secondary)
                .monospacedDigit()
            Button { jumpToMarker(false) } label: {
                Label("tagbar.previous", systemImage: "chevron.backward.to.line").labelStyle(.iconOnly)
            }
            .help("tagbar.previousHelp")
            .disabled(desk.tags.isEmpty)
            Button { jumpToMarker(true) } label: {
                Label("tagbar.next", systemImage: "chevron.forward.to.line").labelStyle(.iconOnly)
            }
            .help("tagbar.nextHelp")
            .disabled(desk.tags.isEmpty)
        }
        .buttonStyle(.bordered)
        .controlSize(.small)
    }
}
