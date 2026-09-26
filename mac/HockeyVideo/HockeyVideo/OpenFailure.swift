import Foundation
import HockeyCore
import HockeyMedia

/// The local store could not be opened, read or written.
struct StoreFailure: Error {
    let underlying: any Error
}

/// Words why a folder did not open, from the String Catalog.
enum OpenFailure {
    static func message(for error: any Error) -> String {
        switch error {
        case let error as GameFolderError: message(for: error)
        case let GameCompositionError.chapter(error): message(for: error)
        case is StoreFailure: String(localized: "error.store")
        default: String(localized: "error.unreadable")
        }
    }

    private static func message(for error: GameFolderError) -> String {
        switch error {
        case .unreadable: String(localized: "error.unreadable")
        case .noParts: String(localized: "error.noParts")
        case let .invalid(problem): message(for: problem)
        case let .chapter(error): message(for: error)
        }
    }

    private static func message(for problem: GamePartsProblem) -> String {
        switch problem {
        case .mixedSchemes: String(localized: "error.mixedSchemes")
        case let .tooManyParts(count): String(localized: "error.tooManyParts \(count) \(maxGameParts)")
        case let .repeated(_, first, second): String(localized: "error.repeated \(first) \(second)")
        case let .missing(label): String(localized: "error.missing \(partName(label))")
        }
    }

    private static func message(for error: ChapterProbeError) -> String {
        switch error {
        case let .unreadable(fileName), let .noDuration(fileName):
            String(localized: "error.chapterUnreadable \(fileName)")
        case let .noVideo(fileName):
            String(localized: "error.chapterNoVideo \(fileName)")
        }
    }

    private static func partName(_ label: PartLabel) -> String {
        switch label.scheme {
        case .halbzeit: String(localized: "part.halbzeit \(label.index)")
        case .viertel: String(localized: "part.viertel \(label.index)")
        case .gopro:
            // The recording number as the file names spell it, `0042`.
            String(localized: "part.gopro \(label.index) \(String(format: "%04d", label.recording))")
        }
    }
}
