import HockeyCore
import Testing

/// The time mapping and source segment ports against the web's vectors.
@Suite("Game time vectors")
struct GameTimeVectorTests {
    @Test(arguments: try VectorFile.cases("time-mapping", call: "totalDurationS"))
    func totalDuration(vector: VectorCase) {
        vector.expect {
            .number(try totalDurationS(vector.input["durationsS"].doubles))
        }
    }

    @Test(arguments: try VectorFile.cases("time-mapping", call: "toSourcePoint"))
    func sourcePoint(vector: VectorCase) {
        vector.expect {
            let point = try toSourcePoint(
                vector.input["durationsS"].doubles,
                gameTimeS: vector.input["gameTimeS"].double
            )
            return .object([
                "sourceIndex": .number(Double(point.sourceIndex)),
                "localOffsetS": .number(point.localOffsetS),
            ])
        }
    }

    @Test(arguments: try VectorFile.cases("time-mapping", call: "toGameTime"))
    func gameTime(vector: VectorCase) {
        vector.expect {
            // A chapter index is an integer here by type, so a fractional one
            // from JSON is rejected before the call, as the reference rejects it.
            guard let sourceIndex = Int(exactly: vector.input["sourceIndex"].double) else {
                throw GameTimeError.chapterOutOfRange
            }
            let point = SourcePoint(
                sourceIndex: sourceIndex,
                localOffsetS: vector.input["localOffsetS"].double
            )
            return .number(try toGameTime(vector.input["durationsS"].doubles, point: point))
        }
    }

    @Test(arguments: try VectorFile.cases("source-segments", call: "toSourceSegments"))
    func sourceSegments(vector: VectorCase) {
        vector.expect {
            let segments = try toSourceSegments(
                vector.input["durationsS"].doubles,
                startS: vector.input["startS"].double,
                endS: vector.input["endS"].double
            )
            return .array(segments.map { segment in
                .object([
                    "sourceIndex": .number(Double(segment.sourceIndex)),
                    "localStartS": .number(segment.localStartS),
                    "localEndS": .number(segment.localEndS),
                ])
            })
        }
    }

    @Test(arguments: try VectorFile.cases("source-segments", call: "windowCrossesBoundary"))
    func crossesBoundary(vector: VectorCase) {
        vector.expect {
            .bool(
                try windowCrossesBoundary(
                    vector.input["durationsS"].doubles,
                    startS: vector.input["startS"].double,
                    endS: vector.input["endS"].double
                )
            )
        }
    }
}

/// What the vectors cannot carry: JSON has no `NaN` or infinity.
@Suite("Game time guards")
struct GameTimeGuardTests {
    @Test func rejectsNonFiniteDurations() {
        #expect(throws: GameTimeError.invalidDuration(chapter: 1)) {
            try totalDurationS([10, .nan])
        }
        #expect(throws: GameTimeError.invalidDuration(chapter: 0)) {
            try totalDurationS([.infinity])
        }
    }

    @Test func rejectsNonFiniteTimes() {
        #expect(throws: GameTimeError.timeOutOfRange) { try toSourcePoint([10], gameTimeS: .nan) }
        #expect(throws: GameTimeError.offsetOutOfRange) {
            try toGameTime([10], point: SourcePoint(sourceIndex: 0, localOffsetS: .infinity))
        }
        #expect(throws: GameTimeError.invalidWindow) {
            try toSourceSegments([10], startS: 0, endS: .nan)
        }
    }

    @Test func chapterStartsAreSumsInChapterOrder() throws {
        let durations = [10.026667, 10.010604, 5.5]
        let starts = try chapterStartsS(durations)
        #expect(starts == [0, 10.026667, 10.026667 + 10.010604])
        for (index, start) in starts.enumerated() {
            #expect(try toSourcePoint(durations, gameTimeS: start).sourceIndex == index)
        }
    }

    @Test func clampsSeeksIntoTheGame() throws {
        #expect(try clampGameTimeS([10, 5], -3) == 0)
        #expect(try clampGameTimeS([10, 5], 20) == 15)
        #expect(try clampGameTimeS([10, 5], 12.5) == 12.5)
        #expect(try clampGameTimeS([10, 5], .nan) == 0)
    }
}
