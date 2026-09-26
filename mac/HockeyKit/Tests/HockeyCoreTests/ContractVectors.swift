import Foundation
import Testing

/// Reads the golden-vector files in `contracts/vectors/` (ADR 0013), the same
/// files the web app generates from its TypeScript, so the Swift ports are
/// tested against the reference's own answers. See `contracts/README.md` for
/// the format.

/// Any JSON value, decoded without a schema.
enum JSONValue: Equatable, Sendable, Decodable, CustomStringConvertible {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else {
            self = .object(try container.decode([String: JSONValue].self))
        }
    }

    var description: String {
        switch self {
        case .null: "null"
        case let .bool(value): "\(value)"
        case let .number(value): "\(value)"
        case let .string(value): "\"\(value)\""
        case let .array(values): "[\(values.map(\.description).joined(separator: ", "))]"
        case let .object(fields):
            "{\(fields.sorted { $0.key < $1.key }.map { "\($0.key): \($0.value)" }.joined(separator: ", "))}"
        }
    }

    /// The value of a field of an object, or a failed expectation.
    subscript(key: String) -> JSONValue {
        guard case let .object(fields) = self, let value = fields[key] else {
            Issue.record("no field \(key) in \(self)")
            return .null
        }
        return value
    }

    var double: Double {
        guard case let .number(value) = self else {
            Issue.record("\(self) is not a number")
            return .nan
        }
        return value
    }

    var string: String {
        guard case let .string(value) = self else {
            Issue.record("\(self) is not a string")
            return ""
        }
        return value
    }

    var array: [JSONValue] {
        guard case let .array(values) = self else {
            Issue.record("\(self) is not a list")
            return []
        }
        return values
    }

    var doubles: [Double] { array.map(\.double) }
    var strings: [String] { array.map(\.string) }

    /// Whether `self` matches `expected`: numbers within `tolerance`, every
    /// other value and the shape of objects and lists exactly.
    func matches(_ expected: JSONValue, tolerance: Double) -> Bool {
        switch (self, expected) {
        case let (.number(lhs), .number(rhs)):
            return abs(lhs - rhs) <= tolerance
        case let (.array(lhs), .array(rhs)):
            return lhs.count == rhs.count
                && zip(lhs, rhs).allSatisfy { $0.matches($1, tolerance: tolerance) }
        case let (.object(lhs), .object(rhs)):
            return Set(lhs.keys) == Set(rhs.keys)
                && lhs.allSatisfy { key, value in
                    value.matches(rhs[key] ?? .null, tolerance: tolerance)
                }
        default:
            return self == expected
        }
    }
}

/// One case: a call of the reference, its input, and its outcome.
struct VectorCase: Decodable, Sendable, CustomTestStringConvertible {
    let name: String
    let call: String
    let input: JSONValue
    /// The value the reference returned; `nil` when it rejected the input.
    let returns: JSONValue?
    let tolerance: Double

    var testDescription: String { name }

    private enum CodingKeys: String, CodingKey {
        case name, call, input, returns, `throws`
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        name = try container.decode(String.self, forKey: .name)
        call = try container.decode(String.self, forKey: .call)
        input = try container.decode(JSONValue.self, forKey: .input)
        let rejects = try container.decodeIfPresent(Bool.self, forKey: .throws) ?? false
        // `returns: null` is a value (no result), so presence decides, not nil.
        returns = rejects ? nil : try container.decode(JSONValue.self, forKey: .returns)
        tolerance = 0
    }

    private init(_ other: VectorCase, tolerance: Double) {
        name = other.name
        call = other.call
        input = other.input
        returns = other.returns
        self.tolerance = tolerance
    }

    func with(tolerance: Double) -> VectorCase { VectorCase(self, tolerance: tolerance) }

    /// Checks the port's outcome against the reference: a value that matches
    /// `returns` within the file's tolerance, or a rejection where the
    /// reference threw.
    func expect(
        _ run: () throws -> JSONValue,
        sourceLocation: SourceLocation = #_sourceLocation
    ) {
        let outcome = Result(catching: run)
        switch (outcome, returns) {
        case let (.success(actual), expected?):
            #expect(
                actual.matches(expected, tolerance: tolerance),
                "\(name): got \(actual), expected \(expected)",
                sourceLocation: sourceLocation
            )
        case let (.success(actual), nil):
            Issue.record("\(name): got \(actual), expected a rejection", sourceLocation: sourceLocation)
        case let (.failure(error), expected?):
            Issue.record("\(name): rejected (\(error)), expected \(expected)", sourceLocation: sourceLocation)
        case (.failure, nil):
            break
        }
    }
}

/// A whole vector file.
struct VectorFile: Decodable, Sendable {
    let contract: String
    let tolerance: Double
    let constants: [String: Double]?
    let cases: [VectorCase]

    /// The repository's `contracts/vectors/` directory, found from this file's
    /// place in the source tree so the tests need no setup.
    static let directory = URL(filePath: #filePath)
        .deletingLastPathComponent() // HockeyCoreTests
        .deletingLastPathComponent() // Tests
        .deletingLastPathComponent() // HockeyKit
        .deletingLastPathComponent() // mac
        .deletingLastPathComponent() // repository root
        .appending(path: "contracts/vectors")

    static func load(_ contract: String) throws -> VectorFile {
        let data = try Data(contentsOf: directory.appending(path: "\(contract).json"))
        return try JSONDecoder().decode(VectorFile.self, from: data)
    }

    /// The cases of one call, each carrying the file's tolerance.
    static func cases(_ contract: String, call: String) throws -> [VectorCase] {
        let file = try load(contract)
        return file.cases.filter { $0.call == call }.map { $0.with(tolerance: file.tolerance) }
    }
}

/// Every vector file a port covers, with the calls it tests. A call the file
/// holds but no test runs fails `everyCallIsTested`, so a new case in the
/// TypeScript cannot go untested here.
let portedContracts: [String: Set<String>] = [
    "time-mapping": ["totalDurationS", "toSourcePoint", "toGameTime"],
    "source-segments": ["toSourceSegments", "windowCrossesBoundary"],
    "game-parts": ["selectGameParts"],
    "source-breaks": ["recordingId", "sourceBreaks"],
    "playback-rate": ["playbackRates", "nextPlaybackRate", "adjustPlaybackRate", "formatPlaybackRate"],
    "game-clock": ["formatGameClock"],
]

@Suite("Contract vectors")
struct ContractVectorFileTests {
    @Test(arguments: portedContracts.keys.sorted())
    func everyCallIsTested(contract: String) throws {
        let file = try VectorFile.load(contract)
        #expect(file.contract == contract)
        #expect(!file.cases.isEmpty)
        #expect(Set(file.cases.map(\.call)) == portedContracts[contract])
    }
}
