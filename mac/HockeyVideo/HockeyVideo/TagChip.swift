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
}

/// A tag type as a small coloured label.
struct TagChip: View {
    let catalog: TagTypeCatalog
    let type: String

    var body: some View {
        let color = catalog.color(forType: type)
        HStack(spacing: 6) {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)
            Text(verbatim: catalog.label(forType: type))
                .lineLimit(1)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(color.opacity(0.15), in: Capsule())
    }
}
