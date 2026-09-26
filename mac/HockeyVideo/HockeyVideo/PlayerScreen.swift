import AppKit
import HockeyCore
import HockeyMedia
import SwiftUI

/// The game: the picture, the scrub bar and the transport, driven by the web's
/// transport keys (`transportCommand(for:shift:)`).
struct PlayerScreen: View {
    let player: GamePlayer
    @FocusState private var hasKeyFocus: Bool

    var body: some View {
        VStack(spacing: 0) {
            VideoSurface(player: player.player)
                .onTapGesture {
                    hasKeyFocus = true
                    player.togglePlay()
                }
            VStack(spacing: 10) {
                ScrubBar(
                    currentS: player.currentTimeS,
                    totalS: player.totalS,
                    breaks: player.breaks
                ) { gameTimeS, isFinal in
                    player.seek(toS: gameTimeS, exact: isFinal)
                }
                TransportBar(player: player, toggleFullscreen: toggleFullscreen)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(.bar)
        }
        .focusable()
        .focusEffectDisabled()
        .focused($hasKeyFocus)
        .onAppear { hasKeyFocus = true }
        .onKeyPress(phases: .down, action: handle)
    }

    /// Runs the transport command a key press stands for. Command, Option and
    /// Control stay with the menus and the system; Shift is a transport
    /// modifier.
    private func handle(_ press: KeyPress) -> KeyPress.Result {
        if !press.modifiers.isDisjoint(with: [.command, .option, .control]) { return .ignored }
        if press.key == .escape {
            guard isFullscreen else { return .ignored }
            toggleFullscreen()
            return .handled
        }
        let key: TransportKey? = switch press.key {
        case .space: .space
        case .leftArrow: .left
        case .rightArrow: .right
        case .upArrow: .up
        case .downArrow: .down
        default: press.characters.count == 1 ? press.characters.first.map(TransportKey.character) : nil
        }
        guard let key, let command = transportCommand(for: key, shift: press.modifiers.contains(.shift)) else {
            return .ignored
        }
        if command == .toggleFullscreen {
            toggleFullscreen()
        } else {
            player.perform(command)
        }
        return .handled
    }

    private var isFullscreen: Bool {
        NSApp.keyWindow?.styleMask.contains(.fullScreen) ?? false
    }

    private func toggleFullscreen() {
        NSApp.keyWindow?.toggleFullScreen(nil)
    }
}
