/// Editing a tag: its type and clip window, checked before it is stored,
/// nudged edge by edge, and whether an edit moves the footage of its clip.
///
/// Ports of `src/features/tagging/validation.ts`,
/// `src/features/tagging/edit/validation.ts`, `edit/trim.ts`, `edit/recut.ts`
/// and `resolveClipEnd` in `src/features/clips/cut/window.ts`, pinned by
/// `contracts/vectors/tag-validation.json`, `tag-edit.json` and `cut-plan.json`.

/// How far one nudge moves a window edge (`TRIM_STEP_S`).
public let trimStepS = 1.0

/// The clip length of a tag without an end whose type has no window, such as a
/// retired type (`FALLBACK_CLIP_WINDOW_S`).
public let fallbackClipWindowS = 20.0

/// A tag's editable fields: its type and its clip window in game time.
public struct TagFields: Equatable, Hashable, Sendable {
    /// A key from `tag-types.json`.
    public var type: String
    public var startS: Double
    /// The explicit end, or `nil` while the tag uses its type's default
    /// follow-through.
    public var endS: Double?

    public init(type: String, startS: Double, endS: Double?) {
        self.type = type
        self.startS = startS
        self.endS = endS
    }
}

/// One edge of a clip window.
public enum WindowEdge: String, Sendable {
    case start
    case end
}

/// Why a tag cannot be stored.
public enum TagValidationError: Error, Equatable, Sendable {
    /// The type is not in the tag-type catalog.
    case unknownType
    /// The start is negative or not finite.
    case invalidStart
    /// The explicit end is not finite or does not lie after the start.
    case invalidEnd
}

/// Checks a tag before it is stored, as the server does for a new tag and an
/// edit: a known type, a finite start of at least 0, and an explicit end after
/// the start.
public func validateTag(_ fields: TagFields, types: TagTypeCatalog) throws(TagValidationError) {
    guard types.isKnown(fields.type) else { throw .unknownType }
    guard fields.startS.isFinite, fields.startS >= 0 else { throw .invalidStart }
    if let endS = fields.endS, !endS.isFinite || endS <= fields.startS {
        throw .invalidEnd
    }
}

/// Why a clip end cannot be resolved.
public enum ClipEndError: Error, Equatable, Sendable {
    case invalidWindow
}

/// The game time a tag's clip ends at: its explicit end, else its type's
/// follow-through after the start, else `fallbackClipWindowS`.
public func resolveClipEnd(
    startS: Double,
    endS: Double?,
    type: String,
    windows: TagWindows
) throws(ClipEndError) -> Double {
    guard startS.isFinite, startS >= 0 else { throw .invalidWindow }
    if let endS {
        guard endS.isFinite, endS > startS else { throw .invalidWindow }
        return endS
    }
    return startS + (windows[type]?.postS ?? fallbackClipWindowS)
}

/// The end a draft window is cut to. Unlike `resolveClipEnd` it never rejects:
/// a draft may be empty or inverted while the coach nudges it.
public func effectiveEnd(_ fields: TagFields, windows: TagWindows) -> Double {
    fields.endS ?? fields.startS + (windows[fields.type]?.postS ?? fallbackClipWindowS)
}

/// Moves one edge by `deltaS`, clamped to `[0, maxS]`. Nudging a default end
/// starts from its effective end and makes it explicit. The other edge never
/// moves, so the result may be empty or inverted; saving is blocked then.
public func nudgeEdge(
    _ fields: TagFields,
    edge: WindowEdge,
    deltaS: Double,
    maxS: Double,
    windows: TagWindows
) -> TagFields {
    let clamp = { (seconds: Double) in min(max(seconds, 0), maxS) }
    var next = fields
    switch edge {
    case .start: next.startS = clamp(fields.startS + deltaS)
    case .end: next.endS = clamp(effectiveEnd(fields, windows: windows) + deltaS)
    }
    return next
}

/// Whether a draft window can be saved: its effective end lies after its start.
public func isValidWindow(_ fields: TagFields, windows: TagWindows) -> Bool {
    effectiveEnd(fields, windows: windows) > fields.startS
}

/// Whether an edit moves the footage a cut clip holds, so the clip must be cut
/// again. A moved start or end always does; a new type only while the end is
/// the type's default, which the type decides.
public func clipWindowChanged(before: TagFields, after: TagFields) -> Bool {
    if before.startS != after.startS || before.endS != after.endS { return true }
    return after.endS == nil && before.type != after.type
}
