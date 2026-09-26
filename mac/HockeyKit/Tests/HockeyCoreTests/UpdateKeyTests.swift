import Foundation
import HockeyCore
import Testing

@Suite("Update key")
struct UpdateKeyTests {
    @Test func acceptsAnEd25519PublicKey() {
        let key = Data(repeating: 7, count: 32).base64EncodedString()
        #expect(key.count == 44)
        #expect(UpdateKey.isUsable(key))
    }

    @Test func refusesThePlaceholderAndMissingKey() {
        #expect(!UpdateKey.isUsable("SPARKLE_PUBLIC_KEY_NOT_SET"))
        #expect(!UpdateKey.isUsable(""))
        #expect(!UpdateKey.isUsable(nil))
        // An unexpanded build setting, as a plist edited by hand could carry.
        #expect(!UpdateKey.isUsable("$(SPARKLE_PUBLIC_ED_KEY)"))
    }

    @Test func refusesKeysOfTheWrongLength() {
        // A private key pasted by mistake is longer; a truncated key shorter.
        #expect(!UpdateKey.isUsable(Data(repeating: 7, count: 64).base64EncodedString()))
        #expect(!UpdateKey.isUsable(Data(repeating: 7, count: 31).base64EncodedString()))
    }
}
