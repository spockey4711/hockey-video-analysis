import AVFoundation
import HockeyCore
import Observation

/// Plays one game as one continuous timeline and drives it in game time: the
/// transport the web player offers (`PlayerController`), on the full-quality
/// originals.
@MainActor
@Observable
public final class GamePlayer {
    public let game: LocalGame
    /// The player the video surface shows.
    public let player: AVPlayer

    /// The game time on screen, in seconds. Follows playback, and jumps to a
    /// seek's target at once so the clock and scrub bar never lag a key press.
    public private(set) var currentTimeS = 0.0
    public private(set) var isPlaying = false
    /// The chosen playback rate; kept while paused and applied on play.
    public private(set) var rate = defaultPlaybackRate

    public var totalS: Double { game.totalS }
    public var breaks: [SourceBreak] { game.breaks }

    /// The seek being carried out, and the latest one asked for since. Seeks
    /// chase the newest target instead of queueing, so holding a key or
    /// dragging the scrub bar never builds a backlog.
    @ObservationIgnored private var seekInFlight = false
    @ObservationIgnored private var pendingSeek: (time: CMTime, exact: Bool)?
    @ObservationIgnored private var settledWaiters: [CheckedContinuation<Void, Never>] = []
    @ObservationIgnored private var timeObserver: Any?
    @ObservationIgnored private var statusObservation: NSKeyValueObservation?

    public init(game: LocalGame, composition: AVComposition) {
        self.game = game
        let item = AVPlayerItem(asset: composition)
        player = AVPlayer(playerItem: item)
        player.actionAtItemEnd = .pause
        timeObserver = player.addPeriodicTimeObserver(
            forInterval: CMTime(value: 1, timescale: 30),
            queue: .main
        ) { [weak self] time in
            MainActor.assumeIsolated { self?.playerDidAdvance(to: time) }
        }
        statusObservation = player.observe(\.timeControlStatus) { [weak self] player, _ in
            let playing = player.timeControlStatus != .paused
            Task { @MainActor in self?.isPlaying = playing }
        }
    }

    isolated deinit {
        if let timeObserver { player.removeTimeObserver(timeObserver) }
        statusObservation?.invalidate()
    }

    /// Readies the player of a game read from its folder.
    public static func open(_ game: LocalGame) async throws -> GamePlayer {
        GamePlayer(game: game, composition: try await makeGameComposition(game))
    }

    // MARK: Transport

    public func play() {
        // Play from the start again once the game has run out.
        if currentTimeS >= totalS { seek(toS: 0) }
        player.playImmediately(atRate: Float(rate))
        isPlaying = true
    }

    public func pause() {
        player.pause()
        isPlaying = false
    }

    public func togglePlay() {
        if isPlaying { pause() } else { play() }
    }

    public func setRate(_ newRate: Double) {
        rate = newRate
        player.defaultRate = Float(newRate)
        if isPlaying { player.rate = Float(newRate) }
    }

    /// Carries out a transport command, apart from fullscreen, which belongs
    /// to the window.
    public func perform(_ command: TransportCommand) {
        switch command {
        case .togglePlay: togglePlay()
        case let .seek(byS: delta): seek(toS: currentTimeS + delta)
        case let .step(byS: delta):
            pause()
            seek(toS: currentTimeS + delta)
        case let .stepFrames(frames): stepFrames(frames)
        case let .adjustRate(direction): setRate(adjustPlaybackRate(rate, direction: direction))
        case .toggleFullscreen: break
        }
    }

    /// Pauses, then moves by whole frames of the chapter's own video.
    public func stepFrames(_ frames: Int) {
        pause()
        let timings = game.chapters.map(\.video)
        guard let target = try? frameStepTargetS(timings, fromGameTimeS: currentTimeS, frames: frames) else { return }
        seek(toS: target)
    }

    /// Moves to a game time, clamped to the game. An exact seek shows the
    /// frame at that time; a rough one (while dragging the scrub bar) shows the
    /// nearest keyframe, which is far faster on long-GOP footage.
    public func seek(toS gameTimeS: Double, exact: Bool = true) {
        let target = (try? clampGameTimeS(game.durationsS, gameTimeS)) ?? 0
        currentTimeS = target
        pendingSeek = (compositionTime(target), exact)
        if !seekInFlight { runPendingSeek() }
    }

    /// Returns once every seek asked for so far has landed.
    public func seeksSettled() async {
        guard seekInFlight || pendingSeek != nil else { return }
        await withCheckedContinuation { settledWaiters.append($0) }
    }

    private func runPendingSeek() {
        guard let (time, exact) = pendingSeek else {
            seekInFlight = false
            let waiters = settledWaiters
            settledWaiters = []
            waiters.forEach { $0.resume() }
            return
        }
        pendingSeek = nil
        seekInFlight = true
        let tolerance = exact ? CMTime.zero : .positiveInfinity
        Task {
            await player.seek(to: time, toleranceBefore: tolerance, toleranceAfter: tolerance)
            runPendingSeek()
        }
    }

    private func playerDidAdvance(to time: CMTime) {
        // While a seek is on its way the clock keeps the target, not the old
        // position the player still reports.
        guard !seekInFlight, time.isNumeric else { return }
        currentTimeS = min(max(time.seconds, 0), totalS)
    }
}
