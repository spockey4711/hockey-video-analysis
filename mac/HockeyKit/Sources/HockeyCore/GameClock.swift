/// The game clock the player shows.
///
/// Port of `formatGameClock` in `src/features/player/format-timecode.ts`,
/// pinned by `contracts/vectors/game-clock.json`.

/// A game time in seconds as `M:SS`, or `H:MM:SS` from the first hour on.
/// Fractions are floored; a negative or non-finite time reads `0:00`.
public func formatGameClock(_ totalSeconds: Double) -> String {
    // The cap only keeps an absurd value from trapping the integer conversion.
    let safe = totalSeconds.isFinite && totalSeconds > 0
        ? Int(min(totalSeconds, 1e15).rounded(.down)) : 0
    let hours = safe / 3600
    let minutes = (safe % 3600) / 60
    let seconds = safe % 60
    let paddedSeconds = seconds < 10 ? "0\(seconds)" : "\(seconds)"
    if hours > 0 {
        let paddedMinutes = minutes < 10 ? "0\(minutes)" : "\(minutes)"
        return "\(hours):\(paddedMinutes):\(paddedSeconds)"
    }
    return "\(minutes):\(paddedSeconds)"
}
