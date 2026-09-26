import HockeyCore
import Testing

@Suite("Transport keys")
struct TransportTests {
    @Test func bindsTheWebKeys() {
        #expect(transportCommand(for: .space, shift: false) == .togglePlay)
        #expect(transportCommand(for: .left, shift: false) == .seek(byS: -5))
        #expect(transportCommand(for: .right, shift: false) == .seek(byS: 5))
        #expect(transportCommand(for: .left, shift: true) == .step(byS: -1))
        #expect(transportCommand(for: .right, shift: true) == .step(byS: 1))
        #expect(transportCommand(for: .character("j"), shift: false) == .seek(byS: -10))
        #expect(transportCommand(for: .character("l"), shift: false) == .seek(byS: 10))
        #expect(transportCommand(for: .character("b"), shift: false) == .stepFrames(-1))
        #expect(transportCommand(for: .character("n"), shift: false) == .stepFrames(1))
        #expect(transportCommand(for: .up, shift: false) == .adjustRate(1))
        #expect(transportCommand(for: .down, shift: false) == .adjustRate(-1))
        #expect(transportCommand(for: .character("f"), shift: false) == .toggleFullscreen)
    }

    @Test func matchesLettersInEitherCase() {
        #expect(transportCommand(for: .character("N"), shift: true) == .stepFrames(1))
        #expect(transportCommand(for: .character("F"), shift: true) == .toggleFullscreen)
    }

    @Test func leavesTheTagAndMarkerKeysAlone() {
        for key in ["t", "e", "g", "s", ",", ".", "d", "x"] {
            #expect(transportCommand(for: .character(Character(key)), shift: false) == nil)
        }
    }
}

@Suite("Frame steps")
struct FrameStepTests {
    /// Two chapters of 50 fps video; the first one's video ends 10 ms before
    /// its stored duration, as when the audio track runs longer.
    let chapters = [
        ChapterVideoTiming(durationS: 10.01, videoStartS: 0, videoEndS: 10, frameDurationS: 0.02),
        ChapterVideoTiming(durationS: 5, videoStartS: 0, videoEndS: 5, frameDurationS: 0.02),
    ]

    @Test func stepsOneRealFrameAt50Fps() throws {
        // A fixed 1/25 s step would jump two frames here.
        #expect(abs(try frameStepTargetS(chapters, fromGameTimeS: 1, frames: 1) - 1.03) < 1e-9)
        #expect(abs(try frameStepTargetS(chapters, fromGameTimeS: 1.03, frames: 1) - 1.05) < 1e-9)
        #expect(abs(try frameStepTargetS(chapters, fromGameTimeS: 1.03, frames: -1) - 1.01) < 1e-9)
    }

    @Test(arguments: [
        ChapterVideoTiming(durationS: 60, videoStartS: 0, videoEndS: 60, frameDurationS: 1.0 / 25),
        ChapterVideoTiming(durationS: 60, videoStartS: 0, videoEndS: 60, frameDurationS: 1.0 / 50),
        ChapterVideoTiming(durationS: 60, videoStartS: 0, videoEndS: 60, frameDurationS: 1001.0 / 60000),
    ])
    func everyStepIsOneFrame(chapter: ChapterVideoTiming) throws {
        var time = try frameStepTargetS([chapter], fromGameTimeS: 30, frames: 0)
        for _ in 0..<200 {
            let next = try frameStepTargetS([chapter], fromGameTimeS: time, frames: 1)
            #expect(abs(next - time - chapter.frameDurationS) < 1e-6)
            #expect(abs(try frameStepTargetS([chapter], fromGameTimeS: next, frames: -1) - time) < 1e-6)
            time = next
        }
    }

    @Test func crossesASeamWithoutLandingInTheGap() throws {
        // The last frame of chapter 0 runs from 9.98 to 10.00.
        let last = try frameStepTargetS(chapters, fromGameTimeS: 9.985, frames: 0)
        #expect(abs(last - 9.99) < 1e-9)
        let next = try frameStepTargetS(chapters, fromGameTimeS: last, frames: 1)
        #expect(abs(next - (10.01 + 0.01)) < 1e-9)
        let back = try frameStepTargetS(chapters, fromGameTimeS: next, frames: -1)
        #expect(abs(back - 9.99) < 1e-9)
        // From inside the gap, forward is the next chapter, back its last frame's neighbour.
        #expect(abs(try frameStepTargetS(chapters, fromGameTimeS: 10.005, frames: 1) - 10.02) < 1e-9)
        #expect(abs(try frameStepTargetS(chapters, fromGameTimeS: 10.005, frames: -1) - 9.97) < 1e-9)
    }

    @Test func holdsAtBothEndsOfTheGame() throws {
        #expect(abs(try frameStepTargetS(chapters, fromGameTimeS: 0, frames: -1) - 0.01) < 1e-9)
        let end = try frameStepTargetS(chapters, fromGameTimeS: 15.01, frames: 1)
        #expect(abs(end - (10.01 + 4.99)) < 1e-9)
    }

    @Test func stepsIntoAChapterWhoseVideoStartsLate() throws {
        let late = [
            ChapterVideoTiming(durationS: 1, videoStartS: 0, videoEndS: 1, frameDurationS: 0.04),
            ChapterVideoTiming(durationS: 1, videoStartS: 0.1, videoEndS: 1, frameDurationS: 0.04),
        ]
        #expect(abs(try frameStepTargetS(late, fromGameTimeS: 0.98, frames: 1) - 1.12) < 1e-9)
        #expect(abs(try frameStepTargetS(late, fromGameTimeS: 1.05, frames: 1) - 1.12) < 1e-9)
    }

    @Test func rejectsATimingWithoutFrames() {
        let broken = [ChapterVideoTiming(durationS: 1, videoStartS: 0, videoEndS: 1, frameDurationS: 0)]
        #expect(throws: GameTimeError.invalidDuration(chapter: 0)) {
            try frameStepTargetS(broken, fromGameTimeS: 0.5, frames: 1)
        }
    }
}
