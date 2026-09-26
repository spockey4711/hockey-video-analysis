import HockeyCore
import Testing

/// The part rules and recording breaks against the web's vectors.
@Suite("Folder vectors")
struct FolderVectorTests {
    @Test func maxPartsMatchesTheReference() throws {
        let file = try VectorFile.load("game-parts")
        #expect(file.constants?["maxParts"] == Double(maxGameParts))
    }

    @Test(arguments: try VectorFile.cases("game-parts", call: "selectGameParts"))
    func gameParts(vector: VectorCase) {
        vector.expect {
            // The reference's English reason is left out of the vectors; the
            // kind is the outcome both apps must agree on.
            switch selectGameParts(vector.input["fileNames"].strings) {
            case let .parts(scheme, parts, ignored):
                .object([
                    "kind": .string("parts"),
                    "scheme": .string(scheme.rawValue),
                    "parts": .array(parts.map(JSONValue.string)),
                    "ignored": .array(ignored.map(JSONValue.string)),
                ])
            case let .none(ignored):
                .object(["kind": .string("none"), "ignored": .array(ignored.map(JSONValue.string))])
            case .invalid:
                .object(["kind": .string("invalid")])
            }
        }
    }

    @Test(arguments: try VectorFile.cases("source-breaks", call: "recordingId"))
    func recording(vector: VectorCase) {
        vector.expect {
            recordingId(vector.input["label"].string).map(JSONValue.string) ?? .null
        }
    }

    @Test(arguments: try VectorFile.cases("source-breaks", call: "sourceBreaks"))
    func breaks(vector: VectorCase) {
        vector.expect {
            let sources = vector.input["sources"].array.map { source in
                SourceBreakInput(label: source["label"].string, durationS: source["durationS"].double)
            }
            return .array(sourceBreaks(sources).map { .object(["startFraction": .number($0.startFraction)]) })
        }
    }
}

/// The reasons the vectors leave out, which the Mac words in its own copy.
@Suite("Game part problems")
struct GamePartProblemTests {
    @Test func namesTheMixedSchemes() {
        #expect(
            selectGameParts(["halbzeit1.mp4", "GX010042.MP4"])
                == .invalid(.mixedSchemes([.gopro, .halbzeit]))
        )
    }

    @Test func namesAMissingChapter() {
        #expect(
            selectGameParts(["GX010042.MP4", "GX030042.MP4"])
                == .invalid(.missing(PartLabel(scheme: .gopro, recording: 42, index: 2)))
        )
    }

    @Test func namesARepeatedHalfTheSameWayInAnyOrder() {
        let expected = GamePartsResult.invalid(
            .repeated(
                PartLabel(scheme: .halbzeit, recording: 0, index: 1),
                first: "Halbzeit 1.mp4",
                second: "halbzeit1.mp4"
            )
        )
        #expect(selectGameParts(["halbzeit1.mp4", "Halbzeit 1.mp4"]) == expected)
        #expect(selectGameParts(["Halbzeit 1.mp4", "halbzeit1.mp4"]) == expected)
    }

    @Test func countsTooManyParts() {
        let names = (1...101).map { "GX01\(String(format: "%04d", $0)).MP4" }
        #expect(selectGameParts(names) == .invalid(.tooManyParts(count: 101)))
    }

    @Test func readsOnlyAsciiDigits() {
        // Swift's `\d` would match other scripts' digits; JavaScript's does not.
        #expect(selectGameParts(["halbzeit\u{0661}.mp4"]) == .none(ignored: ["halbzeit\u{0661}.mp4"]))
    }
}
