import Foundation

/// Why a sync or sign-in stopped. None of the cases carries the token, the
/// password or a request, so an error is safe to show or log.
public enum SyncError: Error, Equatable, Sendable {
    /// The server did not answer: no network, or it is down.
    case offline
    /// The token (or at sign-in, the email and password) was refused.
    case unauthorized
    /// This build is older than the server supports (`426`).
    case updateRequired(minVersion: String)
    /// Too many sign-in attempts; try again after this many seconds.
    case rateLimited(retryAfterS: Int?)
    /// The server answered something the Mac cannot read.
    case invalidAnswer
    /// The server address is not an `https` address (or a local test server).
    case invalidServer
    /// The Keychain did not keep the token.
    case keychain
}

/// Sends one request. `URLSessionTransport` in the app, a fake in tests.
public protocol HTTPTransport: Sendable {
    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse)
}

/// The network, without cookies or a cache: the token is the only credential
/// and no answer is kept.
public struct URLSessionTransport: HTTPTransport {
    private let session: URLSession

    public init() {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieStorage = nil
        configuration.urlCache = nil
        configuration.timeoutIntervalForRequest = 30
        session = URLSession(configuration: configuration)
    }

    public func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        return (data, http)
    }
}

/// An answer the caller decides about: its status, headers and body.
struct Answer {
    let status: Int
    let data: Data
    /// The response headers, by lowercased name.
    var headers: [String: String] = [:]

    /// A byte count the server names in a header, such as `Upload-Offset`.
    func byteCount(_ header: String) -> Int64? {
        headers[header.lowercased()].flatMap { Int64($0.trimmingCharacters(in: .whitespaces)) }
    }

    func decode<Value: Decodable>(_: Value.Type) throws -> Value {
        do {
            return try JSONDecoder.api.decode(Value.self, from: data)
        } catch {
            throw SyncError.invalidAnswer
        }
    }
}

/// The app API of one server (ADR 0013). Every request names this build in
/// `X-HVA-App-Version` and, once signed in, carries the device token. The
/// answers every call shares - offline, `401`, `426`, `429`, `5xx` - become a
/// `SyncError`; the rest are the caller's to read.
struct APIClient: Sendable {
    let server: URL
    let token: String?
    let appVersion: String
    let transport: any HTTPTransport

    /// Sends a JSON `body`, or raw `bytes` (an upload chunk) with `headers`.
    func send(
        _ method: String,
        _ path: String,
        body: (any Encodable)? = nil,
        ifMatch version: Int? = nil,
        bytes: Data? = nil,
        headers: [String: String] = [:]
    ) async throws -> Answer {
        var request = URLRequest(url: server.appending(path: path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(appVersion, forHTTPHeaderField: "X-HVA-App-Version")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let version { request.setValue("\"\(version)\"", forHTTPHeaderField: "If-Match") }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(body)
        } else if let bytes {
            request.setValue("application/octet-stream", forHTTPHeaderField: "Content-Type")
            request.httpBody = bytes
        }
        for (name, value) in headers { request.setValue(value, forHTTPHeaderField: name) }

        let data: Data
        let response: HTTPURLResponse
        do {
            (data, response) = try await transport.send(request)
        } catch {
            throw SyncError.offline
        }
        var answer = Answer(status: response.statusCode, data: data)
        for (name, value) in response.allHeaderFields {
            if let name = name as? String, let value = value as? String { answer.headers[name.lowercased()] = value }
        }
        switch answer.status {
        case 401:
            throw SyncError.unauthorized
        case 426:
            throw SyncError.updateRequired(minVersion: (try? answer.decode(UpdateRequiredPayload.self).minVersion) ?? "")
        case 429:
            throw SyncError.rateLimited(retryAfterS: response.value(forHTTPHeaderField: "Retry-After").flatMap { Int($0) })
        case 500...:
            throw SyncError.offline
        default:
            return answer
        }
    }

    /// Reads a `200` answer, and nothing else.
    func get<Value: Decodable>(_ path: String, as type: Value.Type) async throws -> Value {
        let answer = try await send("GET", path)
        guard answer.status == 200 else { throw SyncError.invalidAnswer }
        return try answer.decode(type)
    }
}

/// The server address the coach typed, as the base of every request: `https`,
/// or `http` for a test server on this Mac. A bare host name gets `https://`.
public func serverURL(from typed: String) throws(SyncError) -> URL {
    var text = typed.trimmingCharacters(in: .whitespacesAndNewlines)
    if !text.contains("://") { text = "https://" + text }
    guard var components = URLComponents(string: text),
          let scheme = components.scheme?.lowercased(),
          let host = components.host?.lowercased(), !host.isEmpty,
          components.user == nil, components.password == nil
    else { throw .invalidServer }
    let isLocal = ["localhost", "127.0.0.1", "::1"].contains(host)
    guard scheme == "https" || (scheme == "http" && isLocal) else { throw .invalidServer }
    components.scheme = scheme
    components.host = host
    components.query = nil
    components.fragment = nil
    while components.path.hasSuffix("/") { components.path.removeLast() }
    guard let url = components.url else { throw .invalidServer }
    return url
}
