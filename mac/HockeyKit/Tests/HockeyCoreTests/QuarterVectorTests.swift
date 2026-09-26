import Foundation
import HockeyCore
import Testing

/// The quarter rules and the editor draft against the web's vectors. The game
/// format is an input: the vectors' quarter length and count go in explicitly.
@Suite("Quarter vectors")
struct QuarterVectorTests {
    @Test(arguments: try VectorFile.cases("quarters", call: "quarterAt"))
    func at(vector: VectorCase) {
        vector.expect { json(quarterAt(quarters(vector.input["quarters"]), gameTimeS: vector.input["gameTimeS"].double)) }
    }

    @Test(arguments: try VectorFile.cases("quarters", call: "quarterWindow"))
    func window(vector: VectorCase) {
        vector.expect {
            let window = quarterWindow(
                quarters(vector.input["quarters"]),
                index: vector.input["index"].int,
                totalDurationS: vector.input["totalDurationS"].double
            )
            return window.map { .object(["startS": .number($0.startS), "endS": .number($0.endS)]) } ?? .null
        }
    }

    @Test(arguments: try VectorFile.cases("quarters", call: "quarterBands"))
    func bands(vector: VectorCase) {
        vector.expect {
            let bands = quarterBands(quarters(vector.input["quarters"]), totalDurationS: vector.input["totalDurationS"].double)
            return .array(bands.map { band in
                .object([
                    "index": .number(Double(band.index)),
                    "startFraction": .number(band.startFraction),
                    "endFraction": .number(band.endFraction),
                ])
            })
        }
    }

    @Test(arguments: try VectorFile.cases("quarters", call: "breakSkipTargetS"))
    func breakSkip(vector: VectorCase) {
        vector.expect {
            .number(orNull: breakSkipTargetS(quarters(vector.input["quarters"]), gameTimeS: vector.input["gameTimeS"].double))
        }
    }

    @Test(arguments: try VectorFile.cases("quarters", call: "quarterClockS"))
    func clock(vector: VectorCase) {
        vector.expect {
            .number(quarterClockS(
                quarters(vector.input["quarters"]),
                gameTimeS: vector.input["gameTimeS"].double,
                periodLengthS: vector.input["periodLengthS"].double
            ))
        }
    }

    @Test(arguments: try VectorFile.cases("quarters", call: "parseQuartersInput"))
    func parse(vector: VectorCase) {
        vector.expect { parseQuarters(vector.input["body"], periodCount: vector.input["periodCount"].int) }
    }

    @Test(arguments: try VectorFile.cases("quarter-draft", call: "toQuarters"))
    func draftQuarters(vector: VectorCase) {
        vector.expect { .array(toQuarters(draft(vector.input["draft"])).map(json)) }
    }

    @Test(arguments: try VectorFile.cases("quarter-draft", call: "draftProblem"))
    func problem(vector: VectorCase) {
        vector.expect { draftProblem(draft(vector.input["draft"])).map { .string($0.rawValue) } ?? .null }
    }

    /// `game-format.json` also pins the settings form, which the Mac does not
    /// have yet, so only its resolve cases run here.
    @Test(arguments: try VectorFile.cases("game-format", call: "resolveGameFormat"))
    func resolveFormat(vector: VectorCase) {
        vector.expect {
            let game = vector.input["game"]
            let team = vector.input["teamDefault"]
            let format = resolveGameFormat(
                periodCount: game["periodCount"] == .null ? nil : game["periodCount"].int,
                periodLengthS: game["periodLengthS"] == .null ? nil : game["periodLengthS"].double,
                teamDefault: GameFormat(periodCount: team["periodCount"].int, periodLengthS: team["periodLengthS"].double)
            )
            return .object([
                "periodCount": .number(Double(format.periodCount)),
                "periodLengthS": .number(format.periodLengthS),
            ])
        }
    }

    @Test func theStandardFormatIsTheVectorsDefault() throws {
        let constants = try #require(VectorFile.load("game-format").constants)
        #expect(Double(GameFormat.standard.periodCount) == constants["defaultPeriodCount"])
        #expect(GameFormat.standard.periodLengthS == constants["defaultPeriodLengthS"])
        #expect(Double(GameFormat.periodLengthMinutes.lowerBound) == constants["minPeriodLengthMin"])
        #expect(Double(GameFormat.periodLengthMinutes.upperBound) == constants["maxPeriodLengthMin"])
        #expect(!GameFormat.isPeriodLengthS(.infinity))
    }

    @Test func theFormatSetsTheRowsAndTheLimit() throws {
        let stored = [Quarter(index: 1, startS: 60, endS: 1500), Quarter(index: 2, startS: 1800, endS: nil)]
        #expect(initialDraft(stored, periodCount: 2).map(\.index) == [1, 2])
        #expect(initialDraft(stored, periodCount: 4)[1] == QuarterDraft(index: 2, startS: 1800, endS: nil))
        #expect(initialDraft([], periodCount: 4)[3] == QuarterDraft(index: 4, startS: nil, endS: nil))
        #expect(try validateQuarters(stored, periodCount: 2) == stored)
        #expect(throws: QuartersError.count) { try validateQuarters(stored, periodCount: 1) }
        #expect(throws: QuartersError.invalidQuarter) {
            try validateQuarters([Quarter(index: 3, startS: 60, endS: nil)], periodCount: 2)
        }
    }

    @Test func nonFiniteTimesFindNoQuarter() {
        let marked = [Quarter(index: 1, startS: 60, endS: 900), Quarter(index: 2, startS: 1000, endS: nil)]
        #expect(quarterAt(marked, gameTimeS: .nan) == nil)
        #expect(breakSkipTargetS(marked, gameTimeS: .infinity) == nil)
        #expect(throws: QuartersError.invalidQuarter) {
            try validateQuarters([Quarter(index: 1, startS: .infinity, endS: nil)], periodCount: 4)
        }
    }
}

private func quarters(_ value: JSONValue) -> [Quarter] {
    value.array.map { Quarter(index: $0["index"].int, startS: $0["startS"].double, endS: optional($0, "endS")) }
}

private func draft(_ value: JSONValue) -> [QuarterDraft] {
    value.array.map {
        QuarterDraft(index: $0["index"].int, startS: optional($0, "startS"), endS: optional($0, "endS"))
    }
}

private func optional(_ value: JSONValue, _ key: String) -> Double? {
    switch value.field(key) {
    case nil, .null?: nil
    case let field?: field.double
    }
}

private func json(_ quarter: Quarter?) -> JSONValue {
    guard let quarter else { return .null }
    return .object([
        "index": .number(Double(quarter.index)),
        "startS": .number(quarter.startS),
        "endS": .number(orNull: quarter.endS),
    ])
}

private struct MalformedBody: Error {}

/// Validates a raw `PUT /api/quarters` body the way `parseQuartersInput`
/// does: decodes its shape (a fractional index fails there, as Swift's `Int`
/// cannot hold it), then applies `validateQuarters`.
private func parseQuarters(_ body: JSONValue, periodCount: Int) -> JSONValue {
    do {
        guard case let .string(gameId)? = body.field("gameId"), UUID(uuidString: gameId) != nil,
              case let .array(entries)? = body.field("quarters")
        else { throw MalformedBody() }
        let parsed = try entries.map { entry in
            guard case let .number(index)? = entry.field("index"), let whole = Int(exactly: index),
                  case let .number(startS)? = entry.field("startS")
            else { throw MalformedBody() }
            let endS: Double? = switch entry.field("endS") {
            case nil, .null?: nil
            case let .number(value)?: value
            default: throw MalformedBody()
            }
            return Quarter(index: whole, startS: startS, endS: endS)
        }
        let valid = try validateQuarters(parsed, periodCount: periodCount)
        return .object([
            "ok": .bool(true),
            "value": .object(["gameId": .string(gameId), "quarters": .array(valid.map(json))]),
        ])
    } catch {
        return .object(["ok": .bool(false)])
    }
}
