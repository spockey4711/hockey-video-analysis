import HockeyStore
import SwiftUI

/// The game's title, opponent and date. A game from this Mac starts under
/// review, as a Drive import does: giving it a title and a date accepts it,
/// under the web review's rules.
struct GameFieldsSheet: View {
    let desk: TaggingDesk
    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var opponent = ""
    @State private var hasDate = false
    @State private var playedOn = Date()
    @State private var failed = false

    var body: some View {
        let underReview = desk.game.fields.isUnderReview
        VStack(alignment: .leading, spacing: 16) {
            Text("game.title").font(.title2.weight(.semibold))
            if underReview {
                Text("game.underReview.hint").foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
            Form {
                TextField("game.field.title", text: $title, prompt: Text(verbatim: desk.game.folderName))
                TextField("game.field.opponent", text: $opponent)
                Toggle("game.field.hasDate", isOn: $hasDate)
                    .disabled(!underReview && desk.game.fields.playedOn != nil)
                if hasDate {
                    DatePicker("game.field.playedOn", selection: $playedOn, displayedComponents: .date)
                }
            }
            if failed {
                Text("game.error.save").foregroundStyle(.red).font(.callout)
            }
            HStack {
                Spacer()
                Button("tag.cancel", role: .cancel) { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Button(underReview && !trimmed(title).isEmpty ? "game.accept" : "tag.save", action: save)
                    .keyboardShortcut(.defaultAction)
                    .disabled(!isValid)
            }
        }
        .padding(20)
        .frame(width: 400)
        .onAppear(perform: load)
    }

    /// A title needs a date: naming a game accepts it, and an accepted game
    /// keeps its date.
    private var isValid: Bool {
        trimmed(title).isEmpty ? desk.game.fields.isUnderReview : hasDate
    }

    private func load() {
        let fields = desk.game.fields
        title = fields.title
        opponent = fields.opponent ?? ""
        hasDate = fields.playedOn != nil
        playedOn = fields.playedOn.flatMap { try? Date($0, strategy: Self.dayFormat) } ?? Date()
    }

    private func save() {
        let opponent = trimmed(opponent)
        let fields = GameFields(
            title: trimmed(title),
            opponent: opponent.isEmpty ? nil : opponent,
            playedOn: hasDate ? playedOn.formatted(Self.dayFormat) : nil
        )
        do {
            try desk.updateGameFields(fields)
            dismiss()
        } catch {
            failed = true
        }
    }

    private func trimmed(_ text: String) -> String {
        text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// `YYYY-MM-DD` in the coach's time zone, the server's date format.
    private static let dayFormat = Date.ISO8601FormatStyle(timeZone: .current).year().month().day()
}
