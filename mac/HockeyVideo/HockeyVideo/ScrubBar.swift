import HockeyCore
import SwiftUI

/// A tag's start on the scrub bar, in its type's colour.
struct ScrubMarker: Identifiable {
    let id: String
    let fraction: Double
    let color: Color
}

/// The game-time scrub bar. It marks where the footage jumps to a new
/// recording, never the seams between the chapters of one recording, like the
/// web's, and shows the quarters as bands and each tag's start as a tick.
struct ScrubBar: View {
    let currentS: Double
    let totalS: Double
    let breaks: [SourceBreak]
    var bands: [QuarterBand] = []
    var markers: [ScrubMarker] = []
    /// Called while dragging (`isFinal` false: a fast, rough seek) and on
    /// release (`isFinal` true: the exact frame).
    let onScrub: (_ gameTimeS: Double, _ isFinal: Bool) -> Void

    private static let trackHeight: CGFloat = 6
    private static let knobSize: CGFloat = 14
    private static let bandHeight: CGFloat = 12
    private static let tickHeight: CGFloat = 10

    var body: some View {
        GeometryReader { geometry in
            let width = geometry.size.width
            let fraction = totalS > 0 ? min(max(currentS / totalS, 0), 1) : 0
            ZStack(alignment: .leading) {
                ForEach(bands, id: \.index) { band in
                    RoundedRectangle(cornerRadius: 3)
                        .fill(.tint.opacity(0.18))
                        .frame(width: max(width * (band.endFraction - band.startFraction), 0), height: Self.bandHeight)
                        .offset(x: width * band.startFraction)
                }
                Capsule()
                    .fill(.quaternary)
                    .frame(height: Self.trackHeight)
                Capsule()
                    .fill(.tint)
                    .frame(width: max(width * fraction, Self.trackHeight), height: Self.trackHeight)
                ForEach(Array(breaks.enumerated()), id: \.offset) { _, recordingBreak in
                    Rectangle()
                        .fill(.primary.opacity(0.7))
                        .frame(width: 2, height: Self.knobSize)
                        .offset(x: width * recordingBreak.startFraction - 1)
                }
                ForEach(markers) { marker in
                    Capsule()
                        .fill(marker.color)
                        .frame(width: 3, height: Self.tickHeight)
                        .offset(x: width * marker.fraction - 1.5, y: -(Self.trackHeight + Self.tickHeight) / 2 - 1)
                }
                Circle()
                    .fill(.white)
                    .shadow(color: .black.opacity(0.3), radius: 1.5, y: 0.5)
                    .frame(width: Self.knobSize, height: Self.knobSize)
                    .offset(x: width * fraction - Self.knobSize / 2)
            }
            .frame(maxHeight: .infinity)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { onScrub(time(at: $0.location.x, width: width), false) }
                    .onEnded { onScrub(time(at: $0.location.x, width: width), true) }
            )
        }
        .frame(height: 28)
        .accessibilityElement()
        .accessibilityLabel("scrub.label")
        .accessibilityValue(formatGameClock(currentS))
        .accessibilityAdjustableAction { direction in
            let delta = direction == .increment ? skipS : -skipS
            onScrub(currentS + delta, true)
        }
    }

    private func time(at x: CGFloat, width: CGFloat) -> Double {
        guard width > 0 else { return 0 }
        return Double(min(max(x / width, 0), 1)) * totalS
    }
}
