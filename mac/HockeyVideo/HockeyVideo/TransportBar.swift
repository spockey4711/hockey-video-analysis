import HockeyCore
import HockeyMedia
import HockeyStore
import SwiftUI

/// The buttons under the picture: the game clock, the skips and steps around
/// play and pause, the speed and fullscreen. Every button has a key; its help
/// tag names it. Once quarters are marked the clock reads match time and the
/// quarter it is in, as on the web.
struct TransportBar: View {
    let player: GamePlayer
    let desk: TaggingDesk
    let toggleFullscreen: () -> Void

    var body: some View {
        HStack(spacing: 16) {
            HStack(spacing: 6) {
                if desk.quarters.isEmpty {
                    Text(verbatim: "\(formatGameClock(player.currentTimeS)) / \(formatGameClock(player.totalS))")
                } else {
                    // Match time has no fixed end, so it stands alone.
                    if let quarter = quarterAt(desk.quarters, gameTimeS: player.currentTimeS) {
                        Text(PeriodCopy(desk.format).band(quarter.index))
                            .foregroundStyle(.tint)
                    }
                    Text(verbatim: formatGameClock(desk.quarterClockS(at: player.currentTimeS)))
                }
            }
            .foregroundStyle(.secondary)
            .monospacedDigit()
            .frame(minWidth: 150, alignment: .leading)

            Spacer()

            HStack(spacing: 14) {
                button("transport.rewind", "gobackward.10", help: "help.rewind") { player.perform(.seek(byS: -skipS)) }
                button("transport.stepBack", "gobackward", help: "help.stepBack") { player.perform(.step(byS: -stepS)) }
                button("transport.frameBack", "backward.frame.fill", help: "help.frameBack") { player.stepFrames(-1) }
                button(
                    player.isPlaying ? "transport.pause" : "transport.play",
                    player.isPlaying ? "pause.fill" : "play.fill",
                    help: "help.playPause"
                ) { player.togglePlay() }
                    .font(.title2)
                    .frame(width: 28)
                button("transport.frameForward", "forward.frame.fill", help: "help.frameForward") { player.stepFrames(1) }
                button("transport.stepForward", "goforward", help: "help.stepForward") { player.perform(.step(byS: stepS)) }
                button("transport.forward", "goforward.10", help: "help.forward") { player.perform(.seek(byS: skipS)) }
            }
            .font(.title3)

            Spacer()

            HStack(spacing: 14) {
                Menu {
                    ForEach(playbackRates, id: \.self) { rate in
                        Toggle(isOn: Binding(get: { player.rate == rate }, set: { _ in player.setRate(rate) })) {
                            Text(verbatim: formatPlaybackRate(rate))
                        }
                    }
                } label: {
                    Text(verbatim: formatPlaybackRate(player.rate))
                        .monospacedDigit()
                }
                .menuStyle(.borderlessButton)
                .menuIndicator(.hidden)
                .fixedSize()
                .help("help.speed")
                .accessibilityLabel("transport.speed")

                button("transport.fullscreen", "arrow.up.left.and.arrow.down.right", help: "help.fullscreen") {
                    toggleFullscreen()
                }
            }
            .frame(minWidth: 150, alignment: .trailing)
        }
        .buttonStyle(.borderless)
    }

    private func button(
        _ label: LocalizedStringKey,
        _ symbol: String,
        help: LocalizedStringKey,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Label(label, systemImage: symbol)
                .labelStyle(.iconOnly)
        }
        .help(help)
    }
}
