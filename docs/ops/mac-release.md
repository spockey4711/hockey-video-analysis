# Mac app releases - signed, notarized, auto-updating

The Mac app in `mac/` ships as a signed, notarized build that keeps itself up to date
([ADR 0013](../decisions/0013-native-mac-app-is-the-coachs-editing-desk.md), D7). A tag
`mac-vMAJOR.MINOR.PATCH` starts [`.github/workflows/mac-release.yml`](../../.github/workflows/mac-release.yml),
which builds, signs, notarizes and publishes the release. The app checks for updates once a day
through [Sparkle 2](https://sparkle-project.org) and offers "Nach Updates suchen …" in the app
menu.

Nothing that identifies the team or unlocks a key is in the repository: the certificate, the
notary key and the Sparkle private key are repository secrets, and a developer's own team id
lives in the gitignored `mac/Local.xcconfig`. The one value that is committed is the Sparkle
**public** key, which every installed app needs to check its updates.

## Set up once, then cut the first release

Do these in order on the Mac that holds the Apple developer account. Steps 1 and 2 need the
account holder's Apple ID (only the account holder can create Developer ID certificates).

1. **Note the team id.** At [developer.apple.com/account](https://developer.apple.com/account),
   under Membership details, copy the 10-character Team ID.
2. **Create the Developer ID Application certificate and export it.**
   1. In Xcode, Settings > Accounts, select the Apple ID, then Manage Certificates.
   2. Click `+` and choose **Developer ID Application**. Xcode creates the certificate and puts it,
      with its private key, into the login keychain.
   3. In Keychain Access, under login > My Certificates, find
      `Developer ID Application: <name> (<team id>)`, right-click it, choose Export, and save it as
      `developer-id.p12` with a strong new password. Keep the file and the password in the
      password manager; the keychain copy stays for local signing.
3. **Create the App Store Connect API key for notarization.**
   1. In [App Store Connect](https://appstoreconnect.apple.com), Users and Access > Integrations >
      App Store Connect API, open Team Keys (request access first if the page asks for it).
   2. Click `+`, name it `Hockey Video notarization`, give it the **Developer** role, and generate
      it.
   3. Download `AuthKey_<key id>.p8`. Apple offers the download only once: put it in the password
      manager at once.
   4. Copy the **Key ID** from the key's row and the **Issuer ID** shown above the table.
4. **Generate the Sparkle key pair.** From the repository root, fetch Sparkle's tools at the
   version the app uses, then generate the keys under their own keychain account:

   ```bash
   xcodebuild -resolvePackageDependencies -project mac/HockeyVideo/HockeyVideo.xcodeproj \
     -scheme HockeyVideo -clonedSourcePackagesDirPath mac/.build/SourcePackages
   SPARKLE=mac/.build/SourcePackages/artifacts/sparkle/Sparkle/bin
   "$SPARKLE/generate_keys" --account hockey-video
   "$SPARKLE/generate_keys" --account hockey-video -x sparkle-private-key.txt
   ```

   The first `generate_keys` stores the private key in the login keychain and prints the public
   key (44 characters ending in `=`). The second exports the private key to a file for the
   secret. Store that file's content in the password manager too: losing the private key means no
   installed app can ever update again, and every Mac would need a manual reinstall.

5. **Commit the public key.** In a PR into `develop`, replace the placeholder in
   `mac/HockeyVideo/HockeyVideo.xcconfig`:

   ```text
   SPARKLE_PUBLIC_ED_KEY = <the public key>
   ```

   The public key is not a secret. Until it is committed, builds leave their updater off and the
   release workflow refuses to run.

6. **Add the repository secrets.** From the repository root, each command reads the value from
   standard input, so nothing lands in the shell history:

   ```bash
   base64 -i developer-id.p12 | gh secret set MAC_DEVELOPER_ID_P12_BASE64
   gh secret set MAC_DEVELOPER_ID_P12_PASSWORD   # paste the .p12 password, then Enter
   gh secret set MAC_TEAM_ID                     # paste the team id from step 1
   base64 -i AuthKey_<key id>.p8 | gh secret set MAC_NOTARY_KEY_P8_BASE64
   gh secret set MAC_NOTARY_KEY_ID               # the Key ID from step 3
   gh secret set MAC_NOTARY_ISSUER_ID            # the Issuer ID from step 3
   gh secret set MAC_SPARKLE_PRIVATE_KEY < sparkle-private-key.txt
   ```

   | Secret                          | What it holds                                             |
   | ------------------------------- | --------------------------------------------------------- |
   | `MAC_DEVELOPER_ID_P12_BASE64`   | The exported Developer ID Application certificate, base64 |
   | `MAC_DEVELOPER_ID_P12_PASSWORD` | The password of that `.p12`                               |
   | `MAC_TEAM_ID`                   | The Apple Developer Team ID                               |
   | `MAC_NOTARY_KEY_P8_BASE64`      | The App Store Connect API key (`.p8`), base64             |
   | `MAC_NOTARY_KEY_ID`             | That key's Key ID                                         |
   | `MAC_NOTARY_ISSUER_ID`          | The Issuer ID of the account's API keys                   |
   | `MAC_SPARKLE_PRIVATE_KEY`       | The exported Sparkle private key                          |

   Then delete `developer-id.p12`, `AuthKey_<key id>.p8` and `sparkle-private-key.txt` from the
   disk; the password manager holds them.

7. **Cut the first release** once the key PR is merged:

   ```bash
   git fetch origin
   git tag mac-v0.1.0 origin/develop
   git push origin mac-v0.1.0
   ```

   The Mac release run usually takes 10 to 20 minutes, most of it waiting for Apple's notary
   service.
   Follow it with `gh run watch` or in the Actions tab. When it is green, the release
   `mac-v0.1.0` holds `HockeyVideo-0.1.0.zip`: download it, unzip it, move `HockeyVideo.app` to
   Programme (Applications) and open it. macOS asks once whether to open an app downloaded from
   the internet; that is the normal prompt for a notarized app, not a warning.

## Cutting a release

- Tag a commit that is merged into `develop` or `master` with `mac-vMAJOR.MINOR.PATCH` and push
  the tag, as in step 7. The tag's version becomes the app's version (`CFBundleShortVersionString`
  and `CFBundleVersion`), so the committed `MARKETING_VERSION` only names local builds.
- Every release must be newer than every earlier `mac-v*` tag: Sparkle only offers a higher
  version. Bump the patch for fixes and the minor for new slices; `1.0.0` is the first release
  the coach relies on daily.
- Installed apps check once a day and ask before installing; "Nach Updates suchen …" checks at
  once.

## What the release workflow does

1. Refuses to start, before building anything, when a secret is missing, the tag is not
   `mac-vMAJOR.MINOR.PATCH`, a newer `mac-v*` tag exists, the tagged commit is on neither
   `develop` nor `master`, or the committed update key is still the placeholder. A refused run
   publishes nothing.
2. Imports the certificate into a throwaway keychain, archives the app with the Developer ID and
   the hardened runtime, and exports it (Xcode re-signs Sparkle's helpers inside the app too).
3. Sends the app to Apple's notary service with `notarytool`, staples the ticket, and checks the
   result the way Gatekeeper will (`spctl`). A rejection prints Apple's log.
4. Zips the stapled app, signs the zip with the Sparkle private key, and writes `appcast.xml`, a
   feed that is itself signed (the app sets `SURequireSignedFeed`).
5. Checks the zip's signature against the public key inside the app, the check an installed app
   makes, so a private key that does not match the committed public key fails here.
6. Publishes the GitHub release `mac-v<version>` with the zip, then replaces `appcast.xml` on the
   rolling release `mac-appcast`, the fixed address every installed app reads
   (`SUFeedURL` in `mac/HockeyVideo/Info.plist`).

Neither release is marked "latest", which stays with the web app's release-please releases.
**Never delete the `mac-appcast` release**: installed apps would stop finding updates until it is
back. If a run fails after publishing the versioned release, "Re-run failed jobs" replaces its zip
and then the appcast.

## Signing local builds

Builds from Xcode or `xcodebuild` without further setup carry only an ad-hoc signature, which is
enough on the Mac that built them. To sign local builds with your own team, copy
`mac/Local.xcconfig.example` to `mac/Local.xcconfig` (gitignored) and fill in your team id.

## Keys and certificates over time

- **Developer ID certificate:** valid for five years. Builds signed and notarized before it expires
  keep opening. Renew it in Xcode as in step 2 and replace the two `MAC_DEVELOPER_ID_P12_*`
  secrets.
- **Notary API key:** does not expire. If it leaks, revoke it in App Store Connect and repeat step
  3 and the three `MAC_NOTARY_*` secrets.
- **Sparkle private key:** never rotate it casually; every installed app trusts only the public
  key it shipped with. If it leaks, follow Sparkle's
  [key rotation steps](https://sparkle-project.org/documentation/#rotating-signing-keys); the
  release that switches keys needs the workflow's signature check adjusted for that one run.
