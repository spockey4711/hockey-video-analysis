import Foundation
import HockeyCore
import Testing

/// The tag types, capture, edit, validation and jump-marker ports against the
/// web's vectors.
@Suite("Tagging vectors")
struct TaggingVectorTests {
    static let catalog = TagTypeCatalog.bundled
    static let windows = catalog.defaultWindows

    /// The bundled copy must be `contracts/tag-types.json` byte for byte;
    /// after the web changes a tag type, copy the file over.
    @Test func bundlesTheContractsTagTypes() throws {
        let contracts = VectorFile.directory.deletingLastPathComponent().appending(path: "tag-types.json")
        let bundled = try #require(TagTypeCatalog.bundledFile)
        #expect(try Data(contentsOf: bundled) == Data(contentsOf: contracts))
        #expect(Self.catalog == (try TagTypeCatalog(json: Data(contentsOf: contracts))))
        #expect(Self.catalog.types.map(\.hotkey) == ["t", "e", "g", "s"])
    }

    @Test(arguments: try VectorFile.cases("tag-capture", call: "captureTag"))
    func capture(vector: VectorCase) {
        vector.expect {
            let input = vector.input
            let window = TagWindow(preS: input["window"]["preS"].double, postS: input["window"]["postS"].double)
            let captured = try captureTag(window: window, atS: input["atS"].double, maxS: input.field("maxS")?.double)
            return .object([
                "type": input["type"],
                "startS": .number(captured.startS),
                "endS": .number(captured.endS),
            ])
        }
    }

    @Test(arguments: try VectorFile.cases("tag-capture", call: "tagTypeForHotkey"))
    func hotkey(vector: VectorCase) {
        vector.expect {
            Self.catalog.type(forHotkey: vector.input["key"].string).map { .string($0.key) } ?? .null
        }
    }

    @Test(arguments: try VectorFile.cases("tag-edit", call: "effectiveEnd"))
    func end(vector: VectorCase) {
        vector.expect { .number(effectiveEnd(fields(vector.input["window"]), windows: Self.windows)) }
    }

    @Test(arguments: try VectorFile.cases("tag-edit", call: "nudgeEdge"))
    func nudge(vector: VectorCase) {
        vector.expect {
            let input = vector.input
            let edge = try #require(WindowEdge(rawValue: input["edge"].string))
            return json(nudgeEdge(
                fields(input["window"]),
                edge: edge,
                deltaS: input["deltaS"].double,
                maxS: input["maxS"].double,
                windows: Self.windows
            ))
        }
    }

    @Test(arguments: try VectorFile.cases("tag-edit", call: "isValidWindow"))
    func validWindow(vector: VectorCase) {
        vector.expect { .bool(isValidWindow(fields(vector.input["window"]), windows: Self.windows)) }
    }

    @Test(arguments: try VectorFile.cases("tag-edit", call: "clipWindowChanged"))
    func recut(vector: VectorCase) {
        vector.expect {
            .bool(clipWindowChanged(before: fields(vector.input["before"]), after: fields(vector.input["after"])))
        }
    }

    @Test(arguments: try VectorFile.cases("cut-plan", call: "resolveClipEnd"))
    func clipEnd(vector: VectorCase) {
        vector.expect {
            let input = vector.input
            return .number(try resolveClipEnd(
                startS: input["startS"].double,
                endS: input.field("endS").flatMap { $0 == .null ? nil : $0.double },
                type: input["tagType"].string,
                windows: Self.windows
            ))
        }
    }

    @Test func fallbackMatchesTheCutPlan() throws {
        #expect(try VectorFile.load("cut-plan").constants?["fallbackClipWindowS"] == fallbackClipWindowS)
        #expect(try VectorFile.load("tag-edit").constants?["trimStepS"] == trimStepS)
    }

    @Test(arguments: try VectorFile.cases("tag-validation", call: "parseTagInput"))
    func newTag(vector: VectorCase) {
        vector.expect { parse(vector.input["body"], withGameId: true) }
    }

    @Test(arguments: try VectorFile.cases("tag-validation", call: "parseTagEditInput"))
    func tagEdit(vector: VectorCase) {
        vector.expect { parse(vector.input["body"], withGameId: false) }
    }

    @Test(arguments: try VectorFile.cases("jump-markers", call: "sortMarkers"))
    func sort(vector: VectorCase) {
        vector.expect { .array(sortMarkers(markers(vector.input)).map(json)) }
    }

    @Test(arguments: try VectorFile.cases("jump-markers", call: "nextMarker"))
    func next(vector: VectorCase) {
        vector.expect { json(nextMarker(markers(vector.input), gameTimeS: vector.input["gameTimeS"].double)) }
    }

    @Test(arguments: try VectorFile.cases("jump-markers", call: "previousMarker"))
    func previous(vector: VectorCase) {
        vector.expect { json(previousMarker(markers(vector.input), gameTimeS: vector.input["gameTimeS"].double)) }
    }

    @Test(arguments: try VectorFile.cases("jump-markers", call: "activeMarker"))
    func active(vector: VectorCase) {
        vector.expect { json(activeMarker(markers(vector.input), gameTimeS: vector.input["gameTimeS"].double)) }
    }

    @Test(arguments: try VectorFile.cases("jump-markers", call: "markerFraction"))
    func fraction(vector: VectorCase) {
        vector.expect {
            .number(markerFraction(vector.input["startS"].double, totalDurationS: vector.input["totalDurationS"].double))
        }
    }

    @Test func markersIgnoreANonFinitePosition() {
        let marker = JumpMarker(id: "a", type: "goal", startS: 10)
        #expect(nextMarker([marker], gameTimeS: .nan) == nil)
        #expect(previousMarker([marker], gameTimeS: .infinity) == nil)
        #expect(activeMarker([marker], gameTimeS: .nan) == nil)
        #expect(markerFraction(10, totalDurationS: .infinity) == 0)
    }

    @Test func refusesNonFiniteCapturesAndWindows() {
        let window = TagWindow(preS: 10, postS: 5)
        #expect(throws: TagCaptureError.timeOutOfRange) { try captureTag(window: window, atS: .nan) }
        #expect(throws: TagCaptureError.gameLengthOutOfRange) { try captureTag(window: window, atS: 1, maxS: .infinity) }
        #expect(throws: TagValidationError.invalidStart) {
            try validateTag(TagFields(type: "goal", startS: .infinity, endS: nil), types: Self.catalog)
        }
        #expect(throws: TagValidationError.invalidEnd) {
            try validateTag(TagFields(type: "goal", startS: 1, endS: .nan), types: Self.catalog)
        }
    }
}

/// A `{type, startS, endS}` window from a vector.
private func fields(_ value: JSONValue) -> TagFields {
    TagFields(
        type: value["type"].string,
        startS: value["startS"].double,
        endS: value["endS"] == .null ? nil : value["endS"].double
    )
}

private func json(_ fields: TagFields) -> JSONValue {
    .object([
        "type": .string(fields.type),
        "startS": .number(fields.startS),
        "endS": .number(orNull: fields.endS),
    ])
}

private func markers(_ input: JSONValue) -> [JumpMarker] {
    input["markers"].array.map { JumpMarker(id: $0["id"].string, type: $0["type"].string, startS: $0["startS"].double) }
}

private func json(_ marker: JumpMarker?) -> JSONValue {
    guard let marker else { return .null }
    return .object(["id": .string(marker.id), "type": .string(marker.type), "startS": .number(marker.startS)])
}

/// Why a raw body never reaches the rule: Swift's types hold only well-formed
/// fields, so a body the reference rejects for its shape is rejected here
/// while decoding it.
private struct MalformedBody: Error {}

/// Validates a raw tag body the way the web's parse functions do: decodes its
/// shape, then applies `validateTag`. A rejection is `{ok: false}`, as the
/// vectors record it.
private func parse(_ body: JSONValue, withGameId: Bool) -> JSONValue {
    do {
        guard case .object = body,
              case let .string(type)? = body.field("type"),
              case let .number(startS)? = body.field("startS")
        else { throw MalformedBody() }
        let endS: Double? = switch body.field("endS") {
        case nil, .null?: nil
        case let .number(value)?: value
        default: throw MalformedBody()
        }
        var value: [String: JSONValue] = [:]
        if withGameId {
            guard case let .string(gameId)? = body.field("gameId"), UUID(uuidString: gameId) != nil
            else { throw MalformedBody() }
            value["gameId"] = .string(gameId)
        }
        let fields = TagFields(type: type, startS: startS, endS: endS)
        try validateTag(fields, types: TaggingVectorTests.catalog)
        value.merge(json(fields).objectFields) { _, new in new }
        return .object(["ok": .bool(true), "value": .object(value)])
    } catch {
        return .object(["ok": .bool(false)])
    }
}

extension JSONValue {
    /// The fields of an object; empty for any other value.
    var objectFields: [String: JSONValue] {
        guard case let .object(fields) = self else { return [:] }
        return fields
    }
}
