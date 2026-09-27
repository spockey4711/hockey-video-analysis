import Foundation

/// Whether a build can install updates: Sparkle accepts an update only when its
/// EdDSA signature verifies against the public key in the app's `Info.plist`
/// (`SUPublicEDKey`). Builds made before the key pair exists carry a
/// placeholder instead (`mac/HockeyVideo/HockeyVideo.xcconfig`), and their
/// updater stays off rather than failing at every launch.
///
/// A Mac-only rule, so no vectors: it pins what the release workflow also
/// checks before it ships a build (`docs/ops/mac-release.md`).
public enum UpdateKey {
    /// Length of an Ed25519 public key.
    public static let byteCount = 32

    /// True for the base64 of exactly one Ed25519 public key, the form
    /// Sparkle's `generate_keys` prints.
    public static func isUsable(_ value: String?) -> Bool {
        guard let value, let key = Data(base64Encoded: value) else { return false }
        return key.count == byteCount
    }
}
