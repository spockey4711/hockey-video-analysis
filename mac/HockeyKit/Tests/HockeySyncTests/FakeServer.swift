import Foundation
import HockeyCore
@testable import HockeySync
import HockeyStore

/// A server in memory that answers the app API the way the routes of S2 to S5
/// do: versions that grow on every change, `If-Match` checks with `409` and the
/// current row, idempotent creates, a revision per game, and the resumable
/// clip uploads with their hand-off. `browser…` changes a row as the web
/// would, so a test can race the Mac against it.
final class FakeServer: HTTPTransport, @unchecked Sendable {
    struct Game {
        var fields: GameFields
        var version = 1
        var revision = 1
        var quarters: [[String: Any]] = []
        var quartersVersion = 1
    }

    struct Tag {
        let gameID: String
        var state: TagState
        var version = 1
        var clip: Clip?
    }

    struct Clip {
        let id: String
        var status: String
        var cutStartS: Double?
        /// The bytes of the file the worker took.
        var file: Data?
    }

    struct Upload {
        let clipID: String
        let sizeBytes: Int
        var bytes = Data()
        var status = "receiving"
        var tagVersion: Int?
        var cutStartS: Double?
    }

    private let lock = NSLock()
    private(set) var games: [String: Game] = [:]
    private(set) var tags: [String: Tag] = [:]
    private(set) var uploads: [String: Upload] = [:]
    /// Goes offline once this many more chunks are stored.
    var offlineAfterChunks: Int?
    /// Moves the tag's start as the browser would, right before the next
    /// hand-off: a trim that races the Mac's upload.
    var trimBeforeHandOff: (tagID: UUID, startS: Double)?
    /// Headers of the answer being built.
    private var replyHeaders: [String: String] = [:]
    var roster: [[String: Any]] = [["id": "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d", "name": "Spielerin A", "jerseyNumber": 7, "version": 1]]
    var rosterRevision = 1
    var isOffline = false
    var minVersion: String?
    var revokedToken = false
    /// Every request, for checking headers.
    private(set) var requests: [URLRequest] = []

    let token = "test-token-not-a-secret"

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        try lock.withLock {
            requests.append(request)
            if isOffline { throw URLError(.notConnectedToInternet) }
            replyHeaders = [:]
            let (status, body) = answer(request)
            let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: replyHeaders)!
            let data = try body.map { try JSONSerialization.data(withJSONObject: $0) } ?? Data()
            return (data, response)
        }
    }

    func withLock<T>(_ body: (FakeServer) throws -> T) rethrows -> T {
        try lock.withLock { try body(self) }
    }

    // MARK: The browser's side

    /// With `keepingVersion`, the change stands for one the Mac read at the
    /// version it has but did not understand, such as further types a build
    /// from before them ignored.
    func browserEditTag(_ id: UUID, keepingVersion: Bool = false, _ change: (inout TagState) -> Void) {
        lock.withLock {
            let key = id.wire
            change(&tags[key]!.state)
            if keepingVersion { return }
            tags[key]!.version += 1
            games[tags[key]!.gameID]!.revision += 1
        }
    }

    func browserDeleteTag(_ id: UUID) {
        lock.withLock {
            let tag = tags.removeValue(forKey: id.wire)!
            games[tag.gameID]!.revision += 1
        }
    }

    func browserAddTag(_ id: UUID, game: UUID, state: TagState) {
        lock.withLock {
            tags[id.wire] = Tag(gameID: game.wire, state: state)
            games[game.wire]!.revision += 1
        }
    }

    /// "Clips schneiden" in the browser: a `pending` clip for the tag.
    func browserCutClip(_ tagID: UUID) {
        lock.withLock {
            let key = tagID.wire
            tags[key]!.clip = Clip(id: UUID().wire, status: "pending")
            games[tags[key]!.gameID]!.revision += 1
        }
    }

    /// The clip worker checks every handed-off file and marks its clip ready.
    func checkHandedOffFiles() {
        lock.withLock {
            for (key, tag) in tags where tag.clip?.status == "processing" {
                let upload = uploads.first { $0.value.clipID == tag.clip!.id && $0.value.status == "submitted" }
                guard let (uploadID, file) = upload else { continue }
                tags[key]!.clip!.status = "ready"
                tags[key]!.clip!.cutStartS = file.cutStartS
                tags[key]!.clip!.file = file.bytes
                uploads[uploadID]!.status = "done"
                games[tag.gameID]!.revision += 1
            }
        }
    }

    func browserEditGame(_ id: UUID, _ change: (inout GameFields) -> Void) {
        lock.withLock {
            change(&games[id.wire]!.fields)
            games[id.wire]!.version += 1
            games[id.wire]!.revision += 1
        }
    }

    // MARK: Routes

    private func answer(_ request: URLRequest) -> (Int, [String: Any]?) {
        let path = request.url!.path()
        let parts = path.split(separator: "/").map(String.init)
        let method = request.httpMethod ?? "GET"
        let body = request.httpBody.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] } ?? [:]
        let ifMatch = request.value(forHTTPHeaderField: "If-Match").flatMap { Int($0.trimmingCharacters(in: CharacterSet(charactersIn: "\""))) }

        if path.hasPrefix("/api/app/v1"), let minVersion { return (426, ["error": "app update required", "minVersion": minVersion]) }
        if path == "/api/app/v1/sessions", method == "POST" {
            return body["password"] as? String == "richtig" ? (201, ["token": token]) : (401, ["error": "invalid credentials"])
        }
        guard !revokedToken, request.value(forHTTPHeaderField: "Authorization") == "Bearer \(token)" else {
            return (401, ["error": "unauthorized"])
        }

        switch (method, parts.dropFirst().joined(separator: "/")) {
        case ("DELETE", "app/v1/sessions"):
            return (204, nil)
        case ("GET", "app/v1/library"):
            return (200, [
                "games": games.map { ["id": $0.key, "title": $0.value.fields.title, "revision": $0.value.revision] },
                "collections": [], "scenes": [], "rosterRevision": rosterRevision,
            ])
        case ("GET", "app/v1/players"):
            return (200, ["rosterRevision": rosterRevision, "players": roster])
        case ("GET", "tag-windows"):
            return (200, ["windows": [["type": "goal", "preS": 12, "postS": 3, "isDefault": false]]])
        case ("POST", "app/v1/games"):
            let id = body["id"] as! String
            if games[id] == nil {
                games[id] = Game(fields: GameFields(title: "", opponent: nil, playedOn: body["playedOn"] as? String))
                return (201, snapshot(id))
            }
            return (200, snapshot(id))
        case ("POST", "tags"):
            let id = body["id"] as! String
            if tags[id] == nil {
                let type = body["type"] as! String
                let state = TagState(
                    type: type,
                    extraTypes: TagTypeCatalog.bundled.normalizeExtraTypes(body["extraTypes"] as? [String] ?? [], mainType: type),
                    startS: body["startS"] as! Double,
                    endS: body["endS"] as? Double
                )
                tags[id] = Tag(gameID: body["gameId"] as! String, state: state)
                games[body["gameId"] as! String]!.revision += 1
            }
            let tag = tags[id]!
            return (201, ["tag": ["id": id, "type": tag.state.type, "extraTypes": tag.state.extraTypes,
                                  "startS": tag.state.startS, "endS": orNull(tag.state.endS),
                                  "visibility": tag.state.visibility.rawValue, "version": tag.version]])
        case ("PUT", "quarters"):
            let gameID = body["gameId"] as! String
            guard ifMatch == games[gameID]!.quartersVersion else {
                return (409, ["error": "version conflict", "quarters": games[gameID]!.quarters, "version": games[gameID]!.quartersVersion])
            }
            games[gameID]!.quarters = body["quarters"] as! [[String: Any]]
            games[gameID]!.quartersVersion += 1
            games[gameID]!.revision += 1
            return (200, ["quarters": games[gameID]!.quarters, "version": games[gameID]!.quartersVersion])
        default:
            break
        }

        if parts.count >= 4, parts[1...3] == ["app", "v1", "uploads"] {
            return uploadRoute(method, id: parts.count == 5 ? parts[4] : nil, request: request, body: body)
        }
        if parts.count == 6, parts[3] == "clips", parts[5] == "file", method == "POST" {
            return handOff(clipID: parts[4], body: body)
        }
        if parts.count >= 3, parts[1] == "tags" {
            return tagRoute(method, id: parts[2], players: parts.count == 4, body: body, ifMatch: ifMatch)
        }
        if parts.count >= 5, parts[3] == "games" {
            return gameRoute(method, id: parts[4], accept: parts.count == 6, body: body, ifMatch: ifMatch)
        }
        return (404, ["error": "not found"])
    }

    private func tagRoute(_ method: String, id: String, players: Bool, body: [String: Any], ifMatch: Int?) -> (Int, [String: Any]?) {
        guard var tag = tags[id] else { return (404, ["error": "tag not found"]) }
        guard ifMatch == tag.version else { return (409, ["error": "version conflict", "tag": json(id, tag)]) }
        var next = tag.state
        if method == "DELETE" {
            tags[id] = nil
            games[tag.gameID]!.revision += 1
            return (204, nil)
        } else if players {
            next.visibility = TagVisibility(rawValue: body["visibility"] as! String)!
            next.playerIds = (body["playerIds"] as! [String]).map { UUID(uuidString: $0)! }
        } else {
            // Without further types the stored ones stay, less a new main type.
            next.type = body["type"] as! String
            next.extraTypes = TagTypeCatalog.bundled.normalizeExtraTypes(
                body["extraTypes"] as? [String] ?? tag.state.extraTypes,
                mainType: next.type
            )
            next.startS = body["startS"] as! Double
            next.endS = body["endS"] as? Double
        }
        if next != tag.state {
            let windowMoved = next.startS != tag.state.startS || next.endS != tag.state.endS
                || (next.endS == nil && next.type != tag.state.type)
            if windowMoved, let status = tag.clip?.status, ["processing", "ready"].contains(status) {
                tag.clip!.status = "pending"
            }
            tag.state = next
            tag.version += 1
            games[tag.gameID]!.revision += 1
            tags[id] = tag
        }
        if players {
            return (200, ["tagPlayers": ["visibility": tag.state.visibility.rawValue, "playerIds": tag.state.playerIds.map(\.wire), "version": tag.version]])
        }
        return (200, ["tag": json(id, tag)])
    }

    private func gameRoute(_ method: String, id: String, accept: Bool, body: [String: Any], ifMatch: Int?) -> (Int, [String: Any]?) {
        guard var game = games[id] else { return (404, ["error": "game not found"]) }
        if method == "GET" { return (200, snapshot(id)) }
        if accept {
            guard game.fields.isUnderReview else { return (409, ["error": "game is not under review", "game": gameJSON(id, game)]) }
            game.fields = GameFields(title: body["title"] as! String, opponent: body["opponent"] as? String, playedOn: body["playedOn"] as? String)
        } else {
            guard ifMatch == game.version else { return (409, ["error": "version conflict", "game": gameJSON(id, game)]) }
            if let title = body["title"] as? String { game.fields.title = title }
            if body.keys.contains("opponent") { game.fields.opponent = body["opponent"] as? String }
            if body.keys.contains("playedOn") { game.fields.playedOn = body["playedOn"] as? String }
        }
        game.version += 1
        game.revision += 1
        games[id] = game
        return (200, ["game": gameJSON(id, game)])
    }

    // MARK: Uploads (S5)

    private func uploadRoute(_ method: String, id: String?, request: URLRequest, body: [String: Any]) -> (Int, [String: Any]?) {
        guard let id else {
            let clipID = body["targetId"] as! String
            guard tags.values.contains(where: { $0.clip?.id == clipID }) else { return (404, ["error": "clip not found"]) }
            let upload = UUID().wire
            uploads[upload] = Upload(clipID: clipID, sizeBytes: body["sizeBytes"] as! Int)
            replyHeaders = ["Upload-Offset": "0"]
            return (201, ["upload": ["id": upload, "sizeBytes": body["sizeBytes"]!, "offset": 0, "status": "receiving",
                                     "expiresAt": "2026-09-28T08:00:00.000Z"]])
        }
        guard var upload = uploads[id] else { return (404, ["error": "upload not found"]) }
        let offsets = { (upload: Upload) in ["Upload-Offset": String(upload.bytes.count), "Upload-Length": String(upload.sizeBytes)] }
        switch method {
        case "HEAD":
            replyHeaders = offsets(upload)
            return (200, nil)
        case "DELETE":
            if upload.status == "submitted" { return (409, ["error": "the clip worker has this upload"]) }
            uploads[id] = nil
            return (204, nil)
        default:
            guard upload.status == "receiving" else { return (409, ["error": "upload is not receiving", "status": upload.status]) }
            let offset = Int(request.value(forHTTPHeaderField: "Upload-Offset")!)!
            guard offset == upload.bytes.count else {
                replyHeaders = offsets(upload)
                return (409, ["error": "offset mismatch", "offset": upload.bytes.count])
            }
            let chunk = request.httpBody ?? Data()
            if offset == 0, chunk.count >= 8, String(decoding: chunk[4..<8], as: UTF8.self) != "ftyp" {
                return (415, ["error": "the file is not an MP4 file"])
            }
            upload.bytes.append(chunk)
            uploads[id] = upload
            replyHeaders = offsets(upload)
            if let left = offlineAfterChunks {
                offlineAfterChunks = left > 1 ? left - 1 : nil
                if left <= 1 { isOffline = true }
            }
            return (204, nil)
        }
    }

    private func handOff(clipID: String, body: [String: Any]) -> (Int, [String: Any]?) {
        if let trim = trimBeforeHandOff {
            trimBeforeHandOff = nil
            var tag = tags[trim.tagID.wire]!
            tag.state.startS = trim.startS
            tag.version += 1
            if tag.clip?.status == "ready" || tag.clip?.status == "processing" { tag.clip!.status = "pending" }
            tags[trim.tagID.wire] = tag
            games[tag.gameID]!.revision += 1
        }
        guard let (tagKey, tag) = tags.first(where: { $0.value.clip?.id == clipID }) else { return (404, ["error": "clip not found"]) }
        let uploadID = body["uploadId"] as! String
        guard let upload = uploads[uploadID] else { return (404, ["error": "upload not found"]) }
        guard upload.clipID == clipID else { return (422, ["error": "upload belongs to another clip"]) }
        let version = body["tagVersion"] as! Int
        if upload.status != "receiving" {
            return upload.tagVersion == version
                ? (202, ["clip": ["id": clipID, "status": tag.clip!.status]])
                : (409, ["error": "upload was handed off already", "status": upload.status])
        }
        guard upload.bytes.count == upload.sizeBytes else { return (409, ["error": "upload is incomplete", "offset": upload.bytes.count]) }
        guard version == tag.version else {
            return (409, ["error": "version conflict", "tag": ["id": tagKey, "version": tag.version, "type": tag.state.type,
                                                              "startS": tag.state.startS, "endS": orNull(tag.state.endS)]])
        }
        guard tag.clip!.status == "pending" else {
            return (409, ["error": "clip is not waiting for a file", "clip": ["id": clipID, "status": tag.clip!.status]])
        }
        let cutStartS = body["cutStartS"] as! Double
        guard cutStartS <= tag.state.startS + 0.05, cutStartS >= tag.state.startS - 10 else {
            return (422, ["error": "cutStartS does not fit the tag's start"])
        }
        uploads[uploadID]!.status = "submitted"
        uploads[uploadID]!.tagVersion = version
        uploads[uploadID]!.cutStartS = cutStartS
        tags[tagKey]!.clip!.status = "processing"
        games[tag.gameID]!.revision += 1
        return (202, ["clip": ["id": clipID, "status": "processing"]])
    }

    private func json(_ id: String, _ tag: Tag) -> [String: Any] {
        ["id": id, "gameId": tag.gameID, "type": tag.state.type, "extraTypes": tag.state.extraTypes,
         "startS": tag.state.startS, "endS": orNull(tag.state.endS),
         "visibility": tag.state.visibility.rawValue, "playerIds": tag.state.playerIds.map(\.wire), "version": tag.version]
    }

    private func gameJSON(_ id: String, _ game: Game) -> [String: Any] {
        ["id": id, "title": game.fields.title, "opponent": orNull(game.fields.opponent), "playedOn": orNull(game.fields.playedOn),
         "periodCount": NSNull(), "periodLengthS": NSNull(), "mediaHome": "mac",
         "version": game.version, "revision": game.revision, "quartersVersion": game.quartersVersion]
    }

    private func snapshot(_ id: String) -> [String: Any] {
        let game = games[id]!
        return [
            "game": gameJSON(id, game),
            "chapters": [],
            "quarters": game.quarters,
            "tags": tags.filter { $0.value.gameID == id }.map { key, tag in
                let clip: Any = tag.clip.map { ["id": $0.id, "status": $0.status, "cutStartS": orNull($0.cutStartS)] } ?? NSNull()
                return json(key, tag).merging(["createdAt": "2026-09-20T15:04:05.000Z", "clip": clip]) { $1 }
            },
        ]
    }
}

/// A JSON value, or `null` for a missing one.
private func orNull(_ value: Any?) -> Any { value ?? NSNull() }

/// A Keychain stand-in that keeps the token in memory.
final class MemoryVault: TokenVault, @unchecked Sendable {
    var saved: (server: URL, token: String)?

    func load() throws -> (server: URL, token: String)? { saved }
    func save(server: URL, token: String) throws { saved = (server, token) }
    func delete() throws { saved = nil }
}
