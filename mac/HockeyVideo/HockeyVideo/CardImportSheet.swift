import HockeyCore
import HockeyMedia
import SwiftUI

/// The card import: the card's recordings to pick from, the copy's progress,
/// and, once every copy is checked, the eject button.
struct CardImportSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let session: CardImportSession

    @State private var isChoosingLibrary = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("import.title \(session.card.name)").font(.title2.weight(.semibold))
            switch session.phase {
            case .choosing: choosing
            case let .copying(progress): copying(progress)
            case .finished: finished
            case let .failed(message): failed(message)
            }
        }
        .padding(20)
        .frame(width: 560)
        .interactiveDismissDisabled(session.isBusy)
        .task { await session.loadThumbnails() }
        .fileImporter(isPresented: $isChoosingLibrary, allowedContentTypes: [.folder]) { result in
            if case let .success(folder) = result { model.library.choose(folder) }
        }
    }

    private var choosing: some View {
        @Bindable var session = session
        return VStack(alignment: .leading, spacing: 12) {
            Text("import.hint").foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            List(session.card.recordings) { recording in
                RecordingRow(recording: recording, thumbnail: session.thumbnails[recording.id], selection: $session.selection)
            }
            .frame(minHeight: 260)
            HStack {
                Label {
                    if let library = model.library.url {
                        Text("import.library \(library.lastPathComponent)")
                    } else {
                        Text("import.library.none")
                    }
                } icon: {
                    Image(systemName: "externaldrive")
                }
                .foregroundStyle(.secondary)
                Button("import.library.choose") { isChoosingLibrary = true }
            }
            HStack {
                if !session.selection.isEmpty {
                    Text("import.size \(CardImportSession.bytes(session.chosenBytes))").foregroundStyle(.secondary)
                }
                Spacer()
                Button("tag.cancel", role: .cancel) { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Button("import.start") {
                    session.start(library: model.library.url) { folder, day in
                        await model.open(folder, importedOn: day)
                    }
                }
                .keyboardShortcut(.defaultAction)
                .disabled(session.chosenBytes == 0 || model.library.url == nil)
            }
        }
    }

    private func copying(_ progress: ImportProgress?) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            ProgressView(value: progress?.fraction ?? 0) {
                if let progress {
                    if progress.step == .copying {
                        Text("import.copying \(progress.fileName) \(progress.fileIndex + 1) \(progress.fileCount)")
                    } else {
                        Text("import.verifying \(progress.fileName) \(progress.fileIndex + 1) \(progress.fileCount)")
                    }
                } else {
                    Text("import.preparing")
                }
            } currentValueLabel: {
                if let progress {
                    Text("import.bytes \(CardImportSession.bytes(min(progress.doneBytes, progress.totalBytes))) \(CardImportSession.bytes(progress.totalBytes))")
                }
            }
            HStack {
                Spacer()
                Button("tag.cancel", role: .cancel) { session.cancelCopy() }
                    .keyboardShortcut(.cancelAction)
            }
        }
    }

    private var finished: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("import.done", systemImage: "checkmark.circle.fill")
                .foregroundStyle(.green)
            if session.ejected {
                Text("import.ejected").foregroundStyle(.secondary)
            } else if session.ejectFailed {
                Text("import.ejectFailed").foregroundStyle(.red).font(.callout)
            }
            HStack {
                Spacer()
                if !session.ejected {
                    Button("import.eject") { Task { await session.eject() } }
                        .disabled(session.isEjecting)
                }
                Button("import.finish") { dismiss() }
                    .keyboardShortcut(.defaultAction)
            }
        }
    }

    private func failed(_ message: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label(message, systemImage: "exclamationmark.triangle.fill")
                .foregroundStyle(.red)
                .fixedSize(horizontal: false, vertical: true)
            HStack {
                Spacer()
                Button("import.close", role: .cancel) { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Button("import.retry") { session.retry() }
                    .keyboardShortcut(.defaultAction)
            }
        }
    }
}

/// One recording to tick: its thumbnail, file number, start, length and size,
/// or why it cannot be imported.
private struct RecordingRow: View {
    let recording: CardRecordingMedia
    let thumbnail: CGImage?
    @Binding var selection: Set<String>

    var body: some View {
        let problem = recording.recording.problem
        Toggle(isOn: isChosen) {
            HStack(spacing: 12) {
                Group {
                    if let thumbnail {
                        Image(decorative: thumbnail, scale: 2).resizable().scaledToFill()
                    } else {
                        Rectangle().fill(.quaternary)
                    }
                }
                .frame(width: 96, height: 54)
                .clipShape(.rect(cornerRadius: 4))
                VStack(alignment: .leading, spacing: 2) {
                    Text("import.recording \(recording.id)").font(.headline)
                    if let startedAt = recording.startedAt {
                        Text(startedAt, format: .dateTime.weekday(.abbreviated).day().month(.abbreviated).year().hour().minute())
                    }
                    if let problem {
                        Text(OpenFailure.message(for: problem)).foregroundStyle(.red)
                    } else {
                        Text(details).foregroundStyle(.secondary)
                    }
                }
                .font(.callout)
            }
        }
        .toggleStyle(.checkbox)
        .disabled(problem != nil)
        .padding(.vertical, 4)
    }

    private var isChosen: Binding<Bool> {
        Binding {
            selection.contains(recording.id)
        } set: { chosen in
            if chosen { selection.insert(recording.id) } else { selection.remove(recording.id) }
        }
    }

    /// Length, size and chapter count: `1:32:10 · 24,1 GB · 7 Kapitel`.
    private var details: String {
        let length = recording.durationS.map(formatGameClock) ?? "-"
        let size = CardImportSession.bytes(recording.recording.sizeBytes)
        return String(localized: "import.details \(length) \(size) \(recording.recording.chapters.count)")
    }
}
