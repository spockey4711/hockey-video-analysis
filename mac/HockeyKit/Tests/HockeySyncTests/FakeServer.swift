import Foundation
@testable import HockeySync
import HockeyStore

/// A server in memory that answers the app API the way the routes of S2 to S4
/// do: versions that grow on every change, `If-Match` checks with `409` and the
/// current row, idempotent creates, and a revision per game. `browser…`
/// changes a row as the web would, so a test can race the Mac against it.
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
    }

    private let lock = NSLock()
    private(set) var games: [String: Game] = [:]
    private(set) var tags: [String: Tag] = [:]
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
            let (status, body) = answer(request)
            let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
            let data = try body.map { try JSONSerialization.data(withJSONObject: $0) } ?? Data()
            return (data, response)
        }
    }

    func withLock<T>(_ body: (FakeServer) throws -> T) rethrows -> T {
        try lock.withLock { try body(self) }
    }

    // MARK: The browser's side

    func browserEditTag(_ id: UUID, _ change: (inout TagState) -> Void) {
        lock.withLock {
            let key = id.wire
            change(&tags[key]!.state)
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
                let state = TagState(type: body["type"] as! String, startS: body["startS"] as! Double, endS: body["endS"] as? Double)
                tags[id] = Tag(gameID: body["gameId"] as! String, state: state)
                games[body["gameId"] as! String]!.revision += 1
            }
            let tag = tags[id]!
            return (201, ["tag": ["id": id, "type": tag.state.type, "startS": tag.state.startS, "endS": orNull(tag.state.endS),
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
            next.visibility = Visibility(rawValue: body["visibility"] as! String)!
            next.playerIds = (body["playerIds"] as! [String]).map { UUID(uuidString: $0)! }
        } else {
            next.type = body["type"] as! String
            next.startS = body["startS"] as! Double
            next.endS = body["endS"] as? Double
        }
        if next != tag.state {
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

    private func json(_ id: String, _ tag: Tag) -> [String: Any] {
        ["id": id, "gameId": tag.gameID, "type": tag.state.type, "startS": tag.state.startS, "endS": orNull(tag.state.endS),
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
            "tags": tags.filter { $0.value.gameID == id }.map { json($0.key, $0.value).merging(["createdAt": "2026-09-20T15:04:05.000Z", "clip": NSNull()]) { $1 } },
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
