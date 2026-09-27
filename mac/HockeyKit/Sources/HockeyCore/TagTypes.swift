import Foundation

/// The tag types a coach captures: `contracts/tag-types.json`, generated from
/// the web's `src/lib/tag-types/config.ts` and bundled with this module
/// unchanged, so both apps offer the same keys, labels, hotkeys and default
/// windows.

/// A clip window around a capture point, in seconds: the clip starts `preS`
/// before the capture and ends `postS` after it.
public struct TagWindow: Equatable, Hashable, Sendable, Codable {
    public let preS: Double
    public let postS: Double

    public init(preS: Double, postS: Double) {
        self.preS = preS
        self.postS = postS
    }
}

/// One tag type.
public struct TagType: Equatable, Sendable, Codable, Identifiable {
    /// Stored in the tag's `type`; never localized.
    public let key: String
    /// The German display name.
    public let label: String
    /// The single key that captures the type.
    public let hotkey: String
    /// The colour alias the chip and marker use (`success`, `info`, ...).
    public let tone: String
    /// The default clip window, which a team or game setting may replace.
    public let window: TagWindow

    public var id: String { key }

    public init(key: String, label: String, hotkey: String, tone: String, window: TagWindow) {
        self.key = key
        self.label = label
        self.hotkey = hotkey
        self.tone = tone
        self.window = window
    }
}

/// The configured tag types in display order.
public struct TagTypeCatalog: Equatable, Sendable {
    public let types: [TagType]

    public init(types: [TagType]) {
        self.types = types
    }

    /// Reads a `tag-types.json` document.
    public init(json: Data) throws {
        struct Document: Decodable {
            let types: [TagType]
        }
        types = try JSONDecoder().decode(Document.self, from: json).types
    }

    /// The copy of `contracts/tag-types.json` bundled with this module.
    public static let bundledFile = Bundle.module.url(forResource: "tag-types", withExtension: "json")

    /// The catalog bundled with the app.
    public static let bundled: TagTypeCatalog = {
        guard let url = bundledFile,
              let data = try? Data(contentsOf: url),
              let catalog = try? TagTypeCatalog(json: data)
        else {
            // The file is part of the build; a build without it is broken.
            preconditionFailure("tag-types.json is missing from HockeyCore's resources")
        }
        return catalog
    }()

    /// The type stored under `key`, or `nil` for a key the catalog lacks.
    public func type(forKey key: String) -> TagType? {
        types.first { $0.key == key }
    }

    /// Whether `key` is a configured type (a valid tag `type`).
    public func isKnown(_ key: String) -> Bool {
        type(forKey: key) != nil
    }

    /// The type a key press captures, matched case-insensitively
    /// (`tagTypeForHotkey`), or `nil` for an unbound key.
    public func type(forHotkey key: String) -> TagType? {
        let pressed = key.lowercased()
        return types.first { $0.hotkey == pressed }
    }

    /// Orders keys as the catalog lists them; a key the catalog lacks goes
    /// last, in the order given.
    func inCatalogOrder(_ keys: [String]) -> [String] {
        let rank = { (key: String) in self.types.firstIndex { $0.key == key } ?? self.types.count }
        return keys.enumerated()
            .sorted { (rank($0.element), $0.offset) < (rank($1.element), $1.offset) }
            .map(\.element)
    }

    /// The further types to store next to `mainType`: without the main type,
    /// without repeats, in the catalog's order (`normalizeExtraTypes`).
    public func normalizeExtraTypes(_ extraTypes: [String], mainType: String) -> [String] {
        var unique: [String] = []
        for key in extraTypes where key != mainType && !unique.contains(key) { unique.append(key) }
        return inCatalogOrder(unique)
    }

    /// The types an edit leaves on a tag from the types the coach switched on
    /// (`tagTypesFromSelection`): the main type stays while it is on, else the
    /// first type on in the catalog's order takes its place. `nil` when none
    /// is on, since a tag always has a type.
    public func tagTypes(fromSelection selected: [String], mainType: String) -> TagTypeSet? {
        var unique: [String] = []
        for key in selected where !unique.contains(key) { unique.append(key) }
        let ordered = inCatalogOrder(unique)
        guard let first = ordered.first else { return nil }
        let type = ordered.contains(mainType) ? mainType : first
        return TagTypeSet(type: type, extraTypes: normalizeExtraTypes(ordered, mainType: type))
    }

    /// Each type's default window, the windows a game uses until a team or
    /// game setting replaces them.
    public var defaultWindows: TagWindows {
        TagWindows(Dictionary(uniqueKeysWithValues: types.map { ($0.key, $0.window) }))
    }
}

/// A tag's types (ADR 0016): the main type it was captured as, which chose
/// its window and colours its marker, and the further types the same moment
/// also counts as, so a short corner that ended in a goal is one tag and one
/// clip. The rules are ports of `src/lib/tag-types/types.ts`, pinned by
/// `contracts/vectors/tag-validation.json` and `tag-edit.json`.
public struct TagTypeSet: Equatable, Hashable, Sendable {
    public var type: String
    /// Never the main type, never twice, in the catalog's order.
    public var extraTypes: [String]

    public init(type: String, extraTypes: [String] = []) {
        self.type = type
        self.extraTypes = extraTypes
    }

    /// Every type, the main type first (`tagTypeKeys`): what every "is this a
    /// goal" asks.
    public var keys: [String] { [type] + extraTypes }
}

/// The clip window of each tag type, as the capture rule and the clip end take
/// them: an input, never looked up inside a rule, because a team or game
/// setting may replace the defaults.
public struct TagWindows: Equatable, Sendable {
    public let byType: [String: TagWindow]

    public init(_ byType: [String: TagWindow]) {
        self.byType = byType
    }

    public subscript(type: String) -> TagWindow? { byType[type] }
}
