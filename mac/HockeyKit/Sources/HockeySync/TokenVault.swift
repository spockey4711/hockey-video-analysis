import Foundation
import Security

/// Where the device token lives between launches. The token is the Mac's only
/// credential; the password is never kept.
public protocol TokenVault: Sendable {
    func load() throws -> (server: URL, token: String)?
    func save(server: URL, token: String) throws
    func delete() throws
}

/// The token in the login Keychain: one generic password item holding the
/// token, with the server address as its account.
public struct KeychainVault: TokenVault {
    public struct Failure: Error, Equatable {
        public let status: OSStatus
    }

    private let service: String

    public init(service: String = "Hockey Video") {
        self.service = service
    }

    private var item: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service]
    }

    public func load() throws -> (server: URL, token: String)? {
        var query = item
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        query[kSecReturnAttributes as String] = true
        query[kSecReturnData as String] = true
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else { throw Failure(status: status) }
        guard let found = result as? [String: Any],
              let account = found[kSecAttrAccount as String] as? String,
              let server = URL(string: account),
              let data = found[kSecValueData as String] as? Data,
              let token = String(data: data, encoding: .utf8)
        else { return nil }
        return (server, token)
    }

    public func save(server: URL, token: String) throws {
        try delete()
        var attributes = item
        attributes[kSecAttrAccount as String] = server.absoluteString
        attributes[kSecAttrLabel as String] = service
        attributes[kSecValueData as String] = Data(token.utf8)
        let status = SecItemAdd(attributes as CFDictionary, nil)
        guard status == errSecSuccess else { throw Failure(status: status) }
    }

    public func delete() throws {
        let status = SecItemDelete(item as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw Failure(status: status) }
    }
}
