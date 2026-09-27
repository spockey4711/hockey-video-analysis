import HockeySync
import SwiftUI

/// Signing the Mac in with the coach's web login. The password goes to the
/// server once and is never kept; the Mac keeps only the device token, in the
/// Keychain.
struct SignInSheet: View {
    let sync: SyncCenter
    @Environment(\.dismiss) private var dismiss

    @State private var server = ""
    @State private var email = ""
    @State private var password = ""
    @State private var deviceName = Host.current().localizedName ?? "Mac"
    @State private var isWorking = false
    @State private var failure: LocalizedStringKey?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("signIn.title").font(.title2.weight(.semibold))
            Text("signIn.hint").foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            Form {
                TextField("signIn.server", text: $server, prompt: Text(verbatim: "hockey.example.org"))
                    .textContentType(.URL)
                TextField("signIn.email", text: $email)
                    .textContentType(.username)
                SecureField("signIn.password", text: $password)
                    .textContentType(.password)
                TextField("signIn.deviceName", text: $deviceName)
            }
            .disabled(isWorking)
            if let failure {
                Text(failure).foregroundStyle(.red).font(.callout)
            }
            HStack {
                Spacer()
                Button("signIn.cancel", role: .cancel) { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Button("signIn.submit", action: submit)
                    .keyboardShortcut(.defaultAction)
                    .disabled(!isComplete || isWorking)
            }
        }
        .padding(20)
        .frame(width: 420)
    }

    private var isComplete: Bool {
        [server, email, password, deviceName].allSatisfy { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
    }

    private func submit() {
        isWorking = true
        failure = nil
        Task {
            defer { isWorking = false }
            do throws(SyncError) {
                try await sync.signIn(server: server, email: email, password: password, deviceName: deviceName)
                password = ""
                dismiss()
            } catch {
                failure = message(for: error)
            }
        }
    }

    private func message(for error: SyncError) -> LocalizedStringKey {
        switch error {
        case .invalidServer: "signIn.error.server"
        case .unauthorized: "signIn.error.credentials"
        case .rateLimited: "signIn.error.rateLimited"
        case .offline: "signIn.error.offline"
        case .updateRequired: "sync.updateRequired.hint"
        case .keychain: "signIn.error.keychain"
        case .invalidAnswer: "signIn.error.answer"
        }
    }
}
