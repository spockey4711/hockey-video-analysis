/// The playback-speed ladder: slow motion for close study and fast scan for
/// hunting a moment, on one ordered list the up and down keys walk.
///
/// Port of `src/features/player/playback-rate.ts`, pinned by
/// `contracts/vectors/playback-rate.json`.

/// Every rate the player offers, slowest first.
public let playbackRates: [Double] = [0.25, 0.5, 1, 2, 4]

/// Normal speed; the rate a game opens at.
public let defaultPlaybackRate: Double = 1

/// The next rate when cycling the speed control, wrapping from the top back to
/// the slowest. An unknown current rate falls back to normal speed.
public func nextPlaybackRate(_ current: Double) -> Double {
    guard let index = playbackRates.firstIndex(of: current) else { return defaultPlaybackRate }
    return playbackRates[(index + 1) % playbackRates.count]
}

/// The rate one rung up (`+1`) or down (`-1`), held at the ends of the ladder.
/// An unknown current rate falls back to normal speed.
public func adjustPlaybackRate(_ current: Double, direction: Int) -> Double {
    guard let index = playbackRates.firstIndex(of: current) else { return defaultPlaybackRate }
    let next = min(max(index + direction.signum(), 0), playbackRates.count - 1)
    return playbackRates[next]
}

/// A rate as the speed control shows it, with the German decimal comma:
/// `2x`, `0,5x`.
public func formatPlaybackRate(_ rate: Double) -> String {
    String(formatJSNumber(rate).map { $0 == "." ? "," : $0 }) + "x"
}

/// A number as JavaScript's `String(number)` writes it, for the values the
/// player shows: whole numbers without a fraction, others in their shortest
/// round-trip form.
func formatJSNumber(_ value: Double) -> String {
    if value.isFinite, value == value.rounded(), abs(value) < 1e15 {
        return String(Int64(value))
    }
    return "\(value)"
}
