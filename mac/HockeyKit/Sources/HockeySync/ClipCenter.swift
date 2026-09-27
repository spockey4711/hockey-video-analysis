import Foundation
import HockeyCore
import HockeyStore
import IOKit.ps
import Observation

/// The clips this Mac cuts for its own games (ADR 0013, Mac plan M6), as the
/// views show them. The waiting clips go one at a time, in the background:
/// after every sync, and every minute while any wait, so a clip goes on where
/// it stopped once the Mac is back online or on power.
@MainActor
@Observable
public final class ClipCenter {
    public private(set) var activity = ClipActivity.idle
    /// The clips waiting for this Mac.
    public private(set) var waitingCount = 0
    /// Clips that wait for the disk their game's chapter files are on.
    public private(set) var missingMediaCount = 0
    /// Whether the work waits because the Mac runs on battery.
    public private(set) var isPausedOnBattery = false
    /// The coach's choice: no cutting or uploading on battery.
    public var pausesOnBattery: Bool {
        didSet {
            try? store.setSetting(Self.pauseKey, to: pausesOnBattery)
            if !pausesOnBattery { kick() }
        }
    }

    @ObservationIgnored private let store: LocalStore
    @ObservationIgnored private let sync: SyncCenter
    @ObservationIgnored private let folder: URL
    @ObservationIgnored private let cutter: any ClipCutting
    @ObservationIgnored private let isOnBattery: @Sendable () -> Bool
    @ObservationIgnored private let chunkBytes: Int
    @ObservationIgnored private var isRunning = false
    @ObservationIgnored private var runAgain = false
    @ObservationIgnored private var loop: Task<Void, Never>?

    private static let pauseKey = "pauseClipsOnBattery"

    /// `folder` holds the cut files until the server has them.
    public init(
        store: LocalStore,
        sync: SyncCenter,
        folder: URL,
        cutter: any ClipCutting = PassthroughCutter(),
        isOnBattery: @escaping @Sendable () -> Bool = runsOnBattery,
        chunkBytes: Int = 8 << 20
    ) {
        self.store = store
        self.sync = sync
        self.folder = folder
        self.cutter = cutter
        self.isOnBattery = isOnBattery
        self.chunkBytes = chunkBytes
        pausesOnBattery = (try? store.setting(Self.pauseKey, as: Bool.self)) ?? false
        refresh()
    }

    /// Works now, then every minute.
    public func start() {
        loop?.cancel()
        loop = Task { [weak self] in
            while !Task.isCancelled {
                await self?.run()
                try? await Task.sleep(for: .seconds(60))
            }
        }
    }

    /// Starts a pass unless one runs; a running pass is followed by another.
    public func kick() {
        Task { await run() }
    }

    /// Cuts and sends every clip that can go now.
    public func run() async {
        guard !isRunning else {
            runAgain = true
            return
        }
        isRunning = true
        defer { isRunning = false }
        repeat {
            runAgain = false
            refresh()
            guard let client = sync.client, waitingCount > 0 else { break }
            let pauses = pausesOnBattery
            let onBattery = isOnBattery
            let worker = ClipWorker(
                store: store,
                client: client,
                folder: folder,
                windows: sync.tagWindows ?? TagTypeCatalog.bundled.defaultWindows,
                cutter: cutter,
                chunkBytes: chunkBytes,
                shouldPause: { pauses && onBattery() },
                report: { [weak self] in self?.activity = $0 }
            )
            // Offline or signed out: the next pass goes on where this stopped.
            let end = try? await worker.run()
            activity = .idle
            isPausedOnBattery = end == .paused
            if case let .done(missing) = end { missingMediaCount = missing }
            refresh()
        } while runAgain
    }

    /// Reads how many clips wait.
    public func refresh() {
        waitingCount = (try? store.clipJobs().count) ?? 0
        if waitingCount == 0 {
            missingMediaCount = 0
            isPausedOnBattery = false
        }
    }
}

/// Whether the Mac draws its power from its battery right now.
public func runsOnBattery() -> Bool {
    guard let info = IOPSCopyPowerSourcesInfo()?.takeRetainedValue(),
          let type = IOPSGetProvidingPowerSourceType(info)?.takeUnretainedValue()
    else { return false }
    return (type as String) == kIOPMBatteryPowerKey
}
