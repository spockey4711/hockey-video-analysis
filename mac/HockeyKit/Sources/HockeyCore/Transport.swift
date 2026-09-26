/// The player's keyboard transport, with the web's bindings
/// (`src/features/player/useTransportHotkeys.ts`), which follow the YouTube
/// convention a coach already knows:
///
/// - Space: play or pause
/// - Left / Right: skip 5 s
/// - J / L: skip 10 s
/// - Shift+Left / Shift+Right: step 1 s, paused on a still frame
/// - B / N: one frame back or forward, paused on a still frame
/// - Up / Down: faster or slower, 0.25x to 4x
/// - F: fullscreen
///
/// A frame step moves one frame of the recording in both apps. The Mac reads
/// each chapter's frame duration from its video track and lands in the middle
/// of the neighbouring frame, crossing chapter seams frame by frame
/// (`frameStepTargetS`).

/// Seconds skipped by J and L.
public let skipS = 10.0
/// Seconds skipped by the left and right arrows.
public let arrowSkipS = 5.0
/// Seconds moved by Shift and an arrow.
public let stepS = 1.0

/// A key as the transport reads it.
public enum TransportKey: Equatable, Sendable {
    case space
    case left
    case right
    case up
    case down
    case character(Character)
}

/// What a transport key does.
public enum TransportCommand: Equatable, Sendable {
    case togglePlay
    /// Moves the play position and keeps playing or pausing as before.
    case seek(byS: Double)
    /// Pauses, then moves the play position.
    case step(byS: Double)
    /// Pauses, then moves by whole video frames.
    case stepFrames(Int)
    /// One rung up (`+1`) or down (`-1`) the playback-rate ladder.
    case adjustRate(Int)
    case toggleFullscreen
}

/// The command a key press triggers, or `nil` for a key the transport leaves
/// alone. Letters match in either case, so Caps Lock or Shift never turn a
/// frame step into a dead key.
public func transportCommand(for key: TransportKey, shift: Bool) -> TransportCommand? {
    switch key {
    case .space: .togglePlay
    case .left: shift ? .step(byS: -stepS) : .seek(byS: -arrowSkipS)
    case .right: shift ? .step(byS: stepS) : .seek(byS: arrowSkipS)
    case .up: .adjustRate(1)
    case .down: .adjustRate(-1)
    case let .character(character):
        switch character.lowercased() {
        case "j": .seek(byS: -skipS)
        case "l": .seek(byS: skipS)
        case "b": .stepFrames(-1)
        case "n": .stepFrames(1)
        case "f": .toggleFullscreen
        default: nil
        }
    }
}
