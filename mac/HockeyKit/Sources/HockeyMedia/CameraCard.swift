import AVFoundation
import HockeyCore

/// A camera card as the import lists it: a disk with GoPro recordings in the
/// camera folders of its `DCIM` folder.
public struct CameraCard: Equatable, Sendable {
    /// Where the card is mounted.
    public let volume: URL
    /// Its recordings by file number.
    public let recordings: [CardRecordingMedia]

    /// The card's name in Finder.
    public var name: String { volume.lastPathComponent }
}

/// One recording on a card, with what the list shows about it.
public struct CardRecordingMedia: Equatable, Sendable, Identifiable {
    public let recording: CardRecording
    /// The chapter files on the card, in play order.
    public let chapterURLs: [URL]
    /// When the recording started: the first chapter's file date, which the
    /// camera writes in its own clock's time.
    public let startedAt: Date?
    /// The recording's length; `nil` when a chapter cannot be read.
    public let durationS: Double?

    public var id: String { recording.id }
}

/// The camera folders of a card: each folder in its `DCIM` folder
/// (`100GOPRO`), in name order.
func cameraFolders(in volume: URL) -> [URL] {
    let dcim = volume.appending(path: "DCIM", directoryHint: .isDirectory)
    let folders = (try? FileManager.default.contentsOfDirectory(
        at: dcim,
        includingPropertiesForKeys: [.isDirectoryKey],
        options: [.skipsHiddenFiles]
    )) ?? []
    return folders
        .filter { (try? $0.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true }
        .sorted { $0.lastPathComponent < $1.lastPathComponent }
}

/// Reads the recordings on the disk mounted at `volume`; `nil` when it is no
/// camera card, so any disk can be asked. Each recording's length is the sum
/// of its chapters' durations, read the way a game folder reads them.
public func readCameraCard(_ volume: URL) async -> CameraCard? {
    var files: [CardFile] = []
    var urls: [CardFile: URL] = [:]
    for folder in cameraFolders(in: volume) {
        let contents = (try? FileManager.default.contentsOfDirectory(
            at: folder,
            includingPropertiesForKeys: [.isRegularFileKey, .fileSizeKey],
            options: [.skipsHiddenFiles]
        )) ?? []
        for url in contents {
            guard let values = try? url.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey]),
                  values.isRegularFile == true
            else { continue }
            let file = CardFile(folder: folder.lastPathComponent, name: url.lastPathComponent, sizeBytes: Int64(values.fileSize ?? 0))
            files.append(file)
            urls[file] = url
        }
    }
    let recordings = cardRecordings(files)
    guard !recordings.isEmpty else { return nil }

    var media: [CardRecordingMedia] = []
    for recording in recordings {
        let chapterURLs = recording.chapters.compactMap { urls[$0] }
        let durationS = try? await probeChapters(chapterURLs).reduce(0) { $0 + $1.durationS }
        media.append(CardRecordingMedia(
            recording: recording,
            chapterURLs: chapterURLs,
            startedAt: chapterURLs.first.flatMap(fileDate),
            durationS: recording.problem == nil ? durationS : nil
        ))
    }
    return CameraCard(volume: volume, recordings: media)
}

/// When a file was made, else when it was last written.
private func fileDate(_ url: URL) -> Date? {
    let values = try? url.resourceValues(forKeys: [.creationDateKey, .contentModificationDateKey])
    return values?.creationDate ?? values?.contentModificationDate
}

/// A small picture of a recording: its first chapter's frame at one second,
/// or its first frame when it is shorter. `nil` when none can be made.
public func recordingThumbnail(_ recording: CardRecordingMedia, maxWidth: Double) async -> CGImage? {
    guard let url = recording.chapterURLs.first else { return nil }
    let generator = AVAssetImageGenerator(asset: AVURLAsset(url: url))
    generator.appliesPreferredTrackTransform = true
    generator.maximumSize = CGSize(width: maxWidth, height: 0)
    let at = min(1, (recording.durationS ?? 0) / 2)
    return try? await generator.image(at: CMTime(seconds: at, preferredTimescale: 600)).image
}
