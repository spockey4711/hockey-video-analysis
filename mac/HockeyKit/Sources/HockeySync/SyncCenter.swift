import Foundation
import HockeyCore
import HockeyStore
import Observation

/// The Mac's link to the server, as the views show it (ADR 0013): the account,
/// how the sync stands, the changes not yet on the server, and the conflicts
/// waiting on the coach. It syncs on launch and activation, every 45 seconds
/// while signed in, and a second after each change on this Mac; every sync
/// pushes first, then pulls.
@MainActor
@Observable
public final class SyncCenter {
    public enum Status: Equatable, Sendable {
        case signedOut
        /// The server refused the token: the Mac was removed under Geräte, or
        /// went unused too long.
        case signedOutByServer
        case syncing
        case synced
        case offline
        /// The server answered something this build cannot read.
        case failed
        /// The server needs a newer build (`426`); syncing stops until then.
        case updateRequired(minVersion: String)
    }

    public private(set) var status: Status
    /// The server this Mac is signed in to.
    public private(set) var server: URL?
    /// Changes on this Mac the server does not have yet.
    public private(set) var unsyncedCount = 0
    public private(set) var conflicts: [Conflict] = []
    /// Changes the server refused for good.
    public private(set) var failures: [PendingChange] = []
    /// The team's clip windows, once a sync brought them.
    public private(set) var tagWindows: TagWindows?
    /// Counts the pulls that changed the store, so an open game reads again.
    public private(set) var pulls = 0
    /// Runs after every sync that reached the server, such as the clip work.
    @ObservationIgnored public var onSynced: (@MainActor () -> Void)?

    @ObservationIgnored private let store: LocalStore
    @ObservationIgnored private let vault: any TokenVault
    @ObservationIgnored private let appVersion: String
    @ObservationIgnored private let transport: any HTTPTransport
    @ObservationIgnored private var token: String?
    @ObservationIgnored private var isSyncing = false
    @ObservationIgnored private var syncAgain = false
    @ObservationIgnored private var loop: Task<Void, Never>?
    @ObservationIgnored private var soon: Task<Void, Never>?

    public init(
        store: LocalStore,
        vault: any TokenVault,
        appVersion: String,
        transport: any HTTPTransport = URLSessionTransport()
    ) {
        self.store = store
        self.vault = vault
        self.appVersion = appVersion
        self.transport = transport
        if let saved = try? vault.load() {
            server = saved.server
            token = saved.token
            status = .synced
        } else {
            status = .signedOut
        }
        refresh()
    }

    /// The client of the server this Mac is signed in to.
    var client: APIClient? {
        guard let server, let token else { return nil }
        return APIClient(server: server, token: token, appVersion: appVersion, transport: transport)
    }

    // MARK: Account

    /// Signs in with the coach's web login and keeps only the device token.
    public func signIn(server typed: String, email: String, password: String, deviceName: String) async throws(SyncError) {
        let url = try serverURL(from: typed)
        let client = APIClient(server: url, token: nil, appVersion: appVersion, transport: transport)
        let body = SignInBody(email: email, password: password, deviceName: deviceName)
        let token: String
        do {
            let answer = try await client.send("POST", "api/app/v1/sessions", body: body)
            guard answer.status == 201 else { throw SyncError.invalidAnswer }
            token = try answer.decode(TokenPayload.self).token
        } catch let error as SyncError {
            if case let .updateRequired(minVersion) = error { status = .updateRequired(minVersion: minVersion) }
            throw error
        } catch {
            throw .invalidAnswer
        }
        do {
            try vault.save(server: url, token: token)
        } catch {
            throw .keychain
        }
        server = url
        self.token = token
        status = .synced
        await syncNow()
    }

    /// Ends the device session on the server, if it answers, and forgets the
    /// token. The games and their unsent changes stay on this Mac.
    public func signOut() async {
        if let client { _ = try? await client.send("DELETE", "api/app/v1/sessions") }
        forget(.signedOut)
    }

    private func forget(_ status: Status) {
        try? vault.delete()
        token = nil
        server = nil
        self.status = status
    }

    // MARK: Syncing

    /// Syncs now and then every 45 seconds.
    public func start() {
        loop?.cancel()
        loop = Task { [weak self] in
            while !Task.isCancelled {
                await self?.syncNow()
                try? await Task.sleep(for: .seconds(45))
            }
        }
    }

    /// After a change on this Mac: counts it at once and sends it shortly,
    /// so a burst of edits goes out together.
    public func noteChange() {
        refresh()
        soon?.cancel()
        soon = Task { [weak self] in
            try? await Task.sleep(for: .seconds(1))
            guard !Task.isCancelled else { return }
            await self?.syncNow()
        }
    }

    /// Pushes every change that can go, then pulls what moved.
    public func syncNow() async {
        if case .updateRequired = status { return }
        guard !isSyncing else {
            syncAgain = true
            return
        }
        isSyncing = true
        defer { isSyncing = false }
        repeat {
            syncAgain = false
            guard let client else { break }
            status = .syncing
            let engine = SyncEngine(store: store, client: client)
            do {
                try await engine.push()
                if try await engine.pull() { pulls += 1 }
                status = .synced
                onSynced?()
            } catch SyncError.unauthorized {
                forget(.signedOutByServer)
            } catch let SyncError.updateRequired(minVersion) {
                status = .updateRequired(minVersion: minVersion)
            } catch SyncError.offline {
                status = .offline
            } catch {
                status = .failed
            }
            refresh()
        } while syncAgain
        refresh()
    }

    // MARK: Conflicts

    /// Settles a conflict with the coach's side and sends the result.
    public func resolve(_ conflict: Conflict, side: ConflictSide) {
        try? store.resolve(conflict.change, side: side)
        pulls += 1
        noteChange()
    }

    /// Drops a change the server refused; the Mac keeps its own state. A
    /// refused registration leaves the game on this Mac only.
    public func drop(_ change: PendingChange) {
        if change.kind == .registerGame {
            try? store.stopSyncing(change.gameID)
        } else {
            try? store.completeChange(change.id)
        }
        refresh()
    }

    /// Reads the outbox again: its count, conflicts and refusals.
    public func refresh() {
        let changes = (try? store.pendingChanges()) ?? []
        unsyncedCount = changes.count
        failures = changes.filter { $0.state == .failed }
        conflicts = (try? store.conflicts()) ?? []
        if let team = try? store.setting(SettingKey.tagWindows, as: [String: TagWindow].self) {
            tagWindows = TagWindows(TagTypeCatalog.bundled.defaultWindows.byType.merging(team) { $1 })
        }
    }
}
