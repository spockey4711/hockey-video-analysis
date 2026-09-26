import AppKit
import HockeyCore
import HockeyMedia
import HockeyStore
import SwiftUI

/// The game: the picture, the scrub bar, the transport and the tag buttons,
/// with the tags rail beside them. Driven by the web's keys: the transport
/// (`transportCommand(for:shift:)`), the tag keys t, e, g and s, and `,` and
/// `.` for the previous and next marker. While playing, the breaks between
/// marked quarters are skipped.
struct PlayerScreen: View {
    let player: GamePlayer
    let desk: TaggingDesk
    @FocusState private var hasKeyFocus: Bool

    /// A confirmation or error shown briefly over the picture.
    @State private var feedback: Feedback?
    /// The skip already asked for in the break the play position is in: a
    /// seek lands a moment later, so the break is skipped with one seek.
    @State private var requestedSkipS: Double?

    private struct Feedback: Equatable {
        let id = UUID()
        let text: String
        let isError: Bool
    }

    var body: some View {
        HStack(spacing: 0) {
            VStack(spacing: 0) {
                VideoSurface(player: player.player)
                    .onTapGesture {
                        hasKeyFocus = true
                        player.togglePlay()
                    }
                    .overlay(alignment: .top) { feedbackBanner }
                VStack(spacing: 10) {
                    ScrubBar(
                        currentS: player.currentTimeS,
                        totalS: player.totalS,
                        breaks: player.breaks,
                        bands: quarterBands(desk.quarters, totalDurationS: player.totalS),
                        markers: desk.tags.map { tag in
                            ScrubMarker(
                                id: tag.id.uuidString,
                                fraction: markerFraction(tag.startS, totalDurationS: player.totalS),
                                color: desk.catalog.color(forType: tag.type)
                            )
                        }
                    ) { gameTimeS, isFinal in
                        player.seek(toS: gameTimeS, exact: isFinal)
                    }
                    TransportBar(player: player, desk: desk, toggleFullscreen: toggleFullscreen)
                    TagBar(desk: desk, capture: capture, jumpToMarker: jumpToMarker)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(.bar)
            }
            Divider()
            GameRail(player: player, desk: desk)
        }
        .focusable()
        .focusEffectDisabled()
        .focused($hasKeyFocus)
        .onAppear { hasKeyFocus = true }
        .onKeyPress(phases: .down, action: handle)
        .onChange(of: player.currentTimeS) { skipBreak() }
        .onChange(of: player.isPlaying) { skipBreak() }
        .task(id: feedback) {
            guard feedback != nil else { return }
            try? await Task.sleep(for: .seconds(2))
            feedback = nil
        }
    }

    @ViewBuilder private var feedbackBanner: some View {
        if let feedback {
            Text(verbatim: feedback.text)
                .font(.callout.weight(.medium))
                .foregroundStyle(feedback.isError ? .red : .primary)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(.regularMaterial, in: Capsule())
                .padding(.top, 12)
                .transition(.opacity)
                .accessibilityAddTraits(.updatesFrequently)
        }
    }

    // MARK: Keys

    /// Runs what a key press stands for. Command, Option and Control stay with
    /// the menus and the system; Shift is a transport modifier, and tag keys
    /// match in either case.
    private func handle(_ press: KeyPress) -> KeyPress.Result {
        if !press.modifiers.isDisjoint(with: [.command, .option, .control]) { return .ignored }
        if press.key == .escape {
            guard isFullscreen else { return .ignored }
            toggleFullscreen()
            return .handled
        }
        if press.characters == "," || press.characters == "." {
            jumpToMarker(forward: press.characters == ".")
            return .handled
        }
        if press.characters.count == 1, let type = desk.catalog.type(forHotkey: press.characters) {
            capture(type)
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

    // MARK: Tagging

    /// Captures a tag of `type` at the play position and confirms it.
    private func capture(_ type: TagType) {
        let atS = player.currentTimeS
        do {
            try desk.capture(type, atS: atS)
            show(String(localized: "tag.captured \(type.label) \(formatGameClock(atS))"))
        } catch {
            show(String(localized: "tag.error.capture"), isError: true)
        }
    }

    /// Jumps to the next or previous tag's start, if there is one.
    private func jumpToMarker(forward: Bool) {
        let from = player.currentTimeS
        guard let marker = forward ? desk.nextMarker(from: from) : desk.previousMarker(from: from) else { return }
        player.seek(toS: marker.startS)
        show(String(localized: "tag.jumpedTo \(desk.catalog.label(forType: marker.type)) \(formatGameClock(marker.startS))"))
    }

    private func show(_ text: String, isError: Bool = false) {
        withAnimation { feedback = Feedback(text: text, isError: isError) }
    }

    /// Jumps over the break the play position has run into. A paused player
    /// is never moved, so the coach can still scrub into a break on purpose.
    private func skipBreak() {
        let target = player.isPlaying ? desk.breakSkipTargetS(at: player.currentTimeS) : nil
        guard target != requestedSkipS else { return }
        requestedSkipS = target
        if let target { player.seek(toS: target) }
    }
}
