/// Capturing a tag: a capture point on the game timeline and a window become
/// the tag's clip window.
///
/// Port of `captureTag` in `src/features/tagging/capture.ts`, pinned by
/// `contracts/vectors/tag-capture.json`. The window is an argument, like the
/// quarter length, because a team or game setting may replace the default.

/// Why a capture was refused.
public enum TagCaptureError: Error, Equatable, Sendable {
    /// The capture time is negative or not finite.
    case timeOutOfRange
    /// The game length is zero, negative or not finite.
    case gameLengthOutOfRange
}

/// The window `[atS - preS, atS + postS]`, clamped to the game: the start never
/// drops below 0, and with a game length `maxS` the capture point and the end
/// never pass it. A tag's type travels with it unchanged, so the result has
/// no type of its own.
public func captureTag(
    window: TagWindow,
    atS: Double,
    maxS: Double? = nil
) throws(TagCaptureError) -> (startS: Double, endS: Double) {
    guard atS.isFinite, atS >= 0 else { throw .timeOutOfRange }
    if let maxS, !maxS.isFinite || maxS <= 0 { throw .gameLengthOutOfRange }

    let at = maxS.map { min(atS, $0) } ?? atS
    let startS = max(0, at - window.preS)
    let endS = maxS.map { min(at + window.postS, $0) } ?? at + window.postS
    return (startS, endS)
}
