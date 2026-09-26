import HockeyCore
import HockeyMedia
import HockeyStore
import SwiftUI

/// The periods editor: one row per period of the game's format, each start
/// and end set to the play position, saved as one set. The breaks between a
/// marked end and the next start are skipped during playback.
struct QuarterEditor: View {
    let player: GamePlayer
    let desk: TaggingDesk

    private enum Status {
        case editing
        case saved
        case failed
    }

    @State private var draft: [QuarterDraft]
    @State private var status = Status.editing

    private var copy: PeriodCopy { PeriodCopy(desk.format) }

    init(player: GamePlayer, desk: TaggingDesk) {
        self.player = player
        self.desk = desk
        _draft = State(initialValue: initialDraft(desk.quarters, periodCount: desk.format.periodCount))
    }

    var body: some View {
        let problem = draftProblem(draft)
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text(copy.hint)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                Grid(alignment: .leading, horizontalSpacing: 8, verticalSpacing: 8) {
                    GridRow {
                        Color.clear.gridCellUnsizedAxes([.horizontal, .vertical])
                        Text("quarters.start").foregroundStyle(.secondary)
                        Text("quarters.end").foregroundStyle(.secondary)
                    }
                    ForEach($draft) { $row in
                        GridRow {
                            Button {
                                player.seek(toS: row.startS ?? 0)
                            } label: {
                                Text(copy.label(row.index))
                            }
                            .buttonStyle(.link)
                            .help(Text(copy.jump(row.index)))
                            boundary(row.startS, help: copy.setStart(row.index)) {
                                row.startS = player.currentTimeS
                            }
                            HStack(spacing: 2) {
                                boundary(row.endS, help: copy.setEnd(row.index)) {
                                    row.endS = player.currentTimeS
                                }
                                .disabled(row.startS == nil)
                                Button {
                                    row.endS = nil
                                } label: {
                                    Label(copy.clearEnd(row.index), systemImage: "xmark.circle.fill")
                                        .labelStyle(.iconOnly)
                                        .foregroundStyle(.secondary)
                                }
                                .buttonStyle(.borderless)
                                .disabled(row.endS == nil)
                            }
                        }
                    }
                }
                if let problem {
                    Text(copy.problem(problem))
                        .font(.callout)
                        .foregroundStyle(.red)
                        .fixedSize(horizontal: false, vertical: true)
                }
                HStack {
                    Button(copy.save, action: save)
                        .buttonStyle(.borderedProminent)
                        .disabled(toQuarters(draft).isEmpty || problem != nil)
                    switch status {
                    case .editing: EmptyView()
                    case .saved: Text(copy.saved).foregroundStyle(.secondary)
                    case .failed: Text(copy.saveFailed).foregroundStyle(.red)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
        }
        .onChange(of: draft) { status = .editing }
    }

    /// A boundary cell: its time, or an invitation to set it.
    private func boundary(_ seconds: Double?, help: LocalizedStringKey, set: @escaping () -> Void) -> some View {
        Button(action: set) {
            Group {
                if let seconds {
                    Text(verbatim: formatGameClock(seconds)).monospacedDigit()
                } else {
                    Text("quarters.unset")
                }
            }
            .frame(minWidth: 56)
        }
        .help(Text(help))
    }

    private func save() {
        do {
            try desk.saveQuarters(toQuarters(draft))
            status = .saved
        } catch {
            status = .failed
        }
    }
}

/// The words for a game's periods: four quarters ("Viertel") or two halves
/// ("Halbzeit"). German inflects the article and ending with the noun, so each
/// format has its own full wording, as on the web.
struct PeriodCopy {
    private let isHalves: Bool

    init(_ format: GameFormat) {
        isHalves = format.periodCount == 2
    }

    var title: LocalizedStringKey { isHalves ? "halves.title" : "rail.quarters" }
    var hint: LocalizedStringKey { isHalves ? "halves.hint" : "quarters.hint" }
    var save: LocalizedStringKey { isHalves ? "halves.save" : "quarters.save" }
    var saved: LocalizedStringKey { isHalves ? "halves.saved" : "quarters.saved" }
    var saveFailed: LocalizedStringKey { isHalves ? "halves.error.save" : "quarters.error.save" }

    func label(_ index: Int) -> LocalizedStringKey {
        isHalves ? "halves.label \(index)" : "quarters.label \(index)"
    }

    func band(_ index: Int) -> LocalizedStringKey {
        isHalves ? "halves.band \(index)" : "quarters.band \(index)"
    }

    func jump(_ index: Int) -> LocalizedStringKey {
        isHalves ? "halves.jump \(index)" : "quarters.jump \(index)"
    }

    func setStart(_ index: Int) -> LocalizedStringKey {
        isHalves ? "halves.setStart \(index)" : "quarters.setStart \(index)"
    }

    func setEnd(_ index: Int) -> LocalizedStringKey {
        isHalves ? "halves.setEnd \(index)" : "quarters.setEnd \(index)"
    }

    func clearEnd(_ index: Int) -> LocalizedStringKey {
        isHalves ? "halves.clearEnd \(index)" : "quarters.clearEnd \(index)"
    }

    func problem(_ problem: QuarterDraftProblem) -> LocalizedStringKey {
        switch (problem, isHalves) {
        case (.gap, false): "quarters.problem.gap"
        case (.endBeforeStart, false): "quarters.problem.endBeforeStart"
        case (.order, false): "quarters.problem.order"
        case (.overlap, false): "quarters.problem.overlap"
        case (.gap, true): "halves.problem.gap"
        case (.endBeforeStart, true): "halves.problem.endBeforeStart"
        case (.order, true): "halves.problem.order"
        case (.overlap, true): "halves.problem.overlap"
        }
    }
}
