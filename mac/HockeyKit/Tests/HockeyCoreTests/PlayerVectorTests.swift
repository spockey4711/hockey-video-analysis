import HockeyCore
import Testing

/// The playback rates and the game clock against the web's vectors.
@Suite("Player vectors")
struct PlayerVectorTests {
    @Test(arguments: try VectorFile.cases("playback-rate", call: "playbackRates"))
    func rates(vector: VectorCase) {
        vector.expect { .array(playbackRates.map(JSONValue.number)) }
    }

    @Test(arguments: try VectorFile.cases("playback-rate", call: "nextPlaybackRate"))
    func nextRate(vector: VectorCase) {
        vector.expect { .number(nextPlaybackRate(vector.input["current"].double)) }
    }

    @Test(arguments: try VectorFile.cases("playback-rate", call: "adjustPlaybackRate"))
    func adjustRate(vector: VectorCase) {
        vector.expect {
            .number(
                adjustPlaybackRate(
                    vector.input["current"].double,
                    direction: Int(vector.input["direction"].double)
                )
            )
        }
    }

    @Test(arguments: try VectorFile.cases("playback-rate", call: "formatPlaybackRate"))
    func rateLabel(vector: VectorCase) {
        vector.expect { .string(formatPlaybackRate(vector.input["rate"].double)) }
    }

    @Test(arguments: try VectorFile.cases("game-clock", call: "formatGameClock"))
    func clock(vector: VectorCase) {
        vector.expect { .string(formatGameClock(vector.input["totalSeconds"].double)) }
    }

    @Test func clockReadsNonFiniteAsZero() {
        #expect(formatGameClock(.nan) == "0:00")
        #expect(formatGameClock(.infinity) == "0:00")
    }
}
