// Checks an update archive's EdDSA signature against a Sparkle public key: the
// check an installed app makes before it accepts the update. The release
// workflow runs it on each new archive with the key inside that archive's app,
// so a signing secret that does not belong to the committed public key, or a
// build that still carries the placeholder key, fails the release instead of
// shipping an app that could never install another update.
//
// Usage: swift verify-update-signature.swift <archive> <signature> <public key>
// (signature and key in base64, as sign_update and generate_keys print them)

import CryptoKit
import Foundation

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data("error: \(message)\n".utf8))
    exit(1)
}

let arguments = CommandLine.arguments.dropFirst()
guard arguments.count == 3 else {
    fail("usage: verify-update-signature.swift <archive> <signature> <public key>")
}
let archivePath = arguments[arguments.startIndex]
let signatureText = arguments[arguments.startIndex + 1]
let keyText = arguments[arguments.startIndex + 2]

guard let keyData = Data(base64Encoded: keyText),
      let key = try? Curve25519.Signing.PublicKey(rawRepresentation: keyData)
else {
    fail("""
    the app's SUPublicEDKey is not an EdDSA public key: \(keyText)
    Replace SPARKLE_PUBLIC_ED_KEY in mac/HockeyVideo/HockeyVideo.xcconfig with the \
    public key (docs/ops/mac-release.md).
    """)
}
guard let signature = Data(base64Encoded: signatureText) else {
    fail("the update's signature is not base64: \(signatureText)")
}
guard let archive = FileManager.default.contents(atPath: archivePath) else {
    fail("cannot read \(archivePath)")
}
guard key.isValidSignature(signature, for: archive) else {
    fail("""
    the update's signature does not match the app's SUPublicEDKey, so the \
    MAC_SPARKLE_PRIVATE_KEY secret is not the private half of the committed public \
    key (docs/ops/mac-release.md).
    """)
}
print("The update's EdDSA signature matches the app's SUPublicEDKey.")
