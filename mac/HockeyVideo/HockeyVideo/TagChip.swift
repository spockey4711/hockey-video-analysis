import HockeyCore
import SwiftUI

/// A tag type's colour, from its tone in `tag-types.json`: the same colour per
/// type as the web's chips and markers (gold goal, blue corner, green good,
/// red bad action).
extension TagTypeCatalog {
    func color(forType key: String) -> Color {
        switch type(forKey: key)?.tone {
        case "success": .yellow
        case "info": .blue
        case "accent": .green
        case "warning": .red
        default: .secondary
        }
    }

    /// A type's German label; the key itself for a type the catalog lacks.
    func label(forType key: String) -> String {
        type(forKey: key)?.label ?? key
    }

    /// A tag's types as one title, the main type first ("Ecke kurz + Tor"),
    /// as the web's `tagTypesLabel`.
    func label(forTypes types: TagTypeSet) -> String {
        types.keys.map(label(forType:)).joined(separator: " + ")
    }
}

/// A tag type as a small coloured label; a type switched off in the tag
/// editor shows faded.
struct TagChip: View {
    let catalog: TagTypeCatalog
    let type: String
    var isOn = true

    var body: some View {
        let color = catalog.color(forType: type)
        HStack(spacing: 6) {
            Circle()
                .fill(isOn ? color : .clear)
                .strokeBorder(color, lineWidth: 1.5)
                .frame(width: 8, height: 8)
            Text(verbatim: catalog.label(forType: type))
                .lineLimit(1)
                .foregroundStyle(isOn ? .primary : .secondary)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(color.opacity(isOn ? 0.15 : 0.04), in: Capsule())
    }
}

/// A tag's types as chips, the main type first, wrapping onto a second line
/// when the rail is too narrow for all of them.
struct TagChips: View {
    let catalog: TagTypeCatalog
    let types: TagTypeSet

    var body: some View {
        ChipFlow {
            ForEach(types.keys, id: \.self) { key in
                TagChip(catalog: catalog, type: key)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: catalog.label(forTypes: types)))
    }
}

/// Lays chips out in rows, left to right, starting a new row when the next
/// chip does not fit.
struct ChipFlow: Layout {
    var spacing: CGFloat = 4

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) -> CGSize {
        let rows = rows(subviews, width: proposal.width ?? .infinity)
        let width = rows.map(\.width).max() ?? 0
        let height = rows.map(\.height).reduce(0, +) + spacing * CGFloat(max(rows.count - 1, 0))
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal _: ProposedViewSize, subviews: Subviews, cache _: inout ()) {
        var y = bounds.minY
        for row in rows(subviews, width: bounds.width) {
            var x = bounds.minX
            for index in row.indices {
                let size = subviews[index].sizeThatFits(.unspecified)
                subviews[index].place(at: CGPoint(x: x, y: y + (row.height - size.height) / 2), proposal: ProposedViewSize(size))
                x += size.width + spacing
            }
            y += row.height + spacing
        }
    }

    private struct Row {
        var indices: [Int] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func rows(_ subviews: Subviews, width: CGFloat) -> [Row] {
        var rows: [Row] = []
        var row = Row()
        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.unspecified)
            let needed = row.indices.isEmpty ? size.width : row.width + spacing + size.width
            if needed > width, !row.indices.isEmpty {
                rows.append(row)
                row = Row()
            }
            row.width = row.indices.isEmpty ? size.width : row.width + spacing + size.width
            row.height = max(row.height, size.height)
            row.indices.append(index)
        }
        if !row.indices.isEmpty { rows.append(row) }
        return rows
    }
}
