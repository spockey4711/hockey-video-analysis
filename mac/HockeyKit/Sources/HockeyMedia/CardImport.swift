import CryptoKit
import Foundation
import Synchronization

/// Copies a card's chapters into a new game folder in the library, and makes
/// sure each copy is the original: same size, same SHA-256. Only then may the
/// card be ejected, so the copies are read back from the disk itself, not from
/// memory.

/// How far an import is. Every byte is copied once and read back once.
public struct ImportProgress: Equatable, Sendable {
    public enum Step: Equatable, Sendable {
        case copying
        case verifying
    }

    public let step: Step
    public let fileName: String
    /// The file at work, from 0, and how many there are.
    public let fileIndex: Int
    public let fileCount: Int
    /// Bytes of the copy's size that are copied and checked.
    public let doneBytes: Int64
    public let totalBytes: Int64

    public var fraction: Double {
        totalBytes > 0 ? Double(doneBytes) / Double(2 * totalBytes) : 0
    }
}

/// Why an import stopped. It leaves no game folder behind.
public enum CardImportError: Error, Equatable, Sendable {
    /// The library's disk has too little free space.
    case noSpace(neededBytes: Int64, freeBytes: Int64)
    /// The game folder cannot be made or written, or already exists.
    case unwritable
    /// A chapter on the card cannot be read.
    case unreadable(fileName: String)
    /// A copy differs from its original in size or checksum.
    case mismatch(fileName: String)
    case cancelled
}

/// Copies the chapter files into a new folder `folderName` in `library` and
/// returns it. Each copy is written under a hidden name, read back and checked
/// against the original's size and checksum, and only then gets its name, so
/// the folder never holds a chapter that is not the original. Cancelling the
/// task stops the copy.
public func copyChapters(
    _ chapters: [URL],
    into library: URL,
    folderName: String,
    progress: @escaping @Sendable (ImportProgress) -> Void
) async throws(CardImportError) -> URL {
    let flag = CancelFlag()
    // Minutes of blocking file I/O belong on their own thread, not on the
    // shared pool async work runs on.
    let result = await withTaskCancellationHandler {
        await withCheckedContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                continuation.resume(returning: Result { () throws(CardImportError) -> URL in
                    try copyChaptersNow(
                        chapters,
                        into: library,
                        folderName: folderName,
                        isCancelled: { flag.isSet },
                        progress: progress
                    )
                })
            }
        }
    } onCancel: {
        flag.set()
    }
    return try result.get()
}

private final class CancelFlag: Sendable {
    private let value = Atomic(false)
    var isSet: Bool { value.load(ordering: .relaxed) }
    func set() { value.store(true, ordering: .relaxed) }
}

/// The blocking copy behind `copyChapters`.
func copyChaptersNow(
    _ chapters: [URL],
    into library: URL,
    folderName: String,
    isCancelled: () -> Bool,
    progress: (ImportProgress) -> Void
) throws(CardImportError) -> URL {
    var sizes: [Int64] = []
    for url in chapters {
        guard let size = try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize else {
            throw .unreadable(fileName: url.lastPathComponent)
        }
        sizes.append(Int64(size))
    }
    let totalBytes = sizes.reduce(0, +)
    let free = try? library.resourceValues(forKeys: [.volumeAvailableCapacityKey]).volumeAvailableCapacity
    if let free, Int64(free) < totalBytes {
        throw .noSpace(neededBytes: totalBytes, freeBytes: Int64(free))
    }

    let folder = library.appending(path: folderName, directoryHint: .isDirectory)
    do {
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
    } catch {
        throw .unwritable
    }
    do throws(CardImportError) {
        var doneBytes: Int64 = 0
        for (index, (source, sizeBytes)) in zip(chapters, sizes).enumerated() {
            let name = source.lastPathComponent
            func report(_ step: ImportProgress.Step, _ bytes: Int64) {
                doneBytes += bytes
                progress(ImportProgress(
                    step: step,
                    fileName: name,
                    fileIndex: index,
                    fileCount: chapters.count,
                    doneBytes: doneBytes,
                    totalBytes: totalBytes
                ))
            }
            let hidden = folder.appending(path: ".\(name).part")
            let digest = try copyFile(source, to: hidden, sizeBytes: sizeBytes, isCancelled: isCancelled) {
                report(.copying, $0)
            }
            try checkCopy(hidden, name: name, sizeBytes: sizeBytes, digest: digest, isCancelled: isCancelled) {
                report(.verifying, $0)
            }
            do {
                try FileManager.default.moveItem(at: hidden, to: folder.appending(path: name))
                if let dates = try? FileManager.default.attributesOfItem(atPath: source.path(percentEncoded: false)) {
                    try? FileManager.default.setAttributes(
                        [.creationDate: dates[.creationDate], .modificationDate: dates[.modificationDate]]
                            .compactMapValues(\.self),
                        ofItemAtPath: folder.appending(path: name).path(percentEncoded: false)
                    )
                }
            } catch {
                throw .unwritable
            }
        }
        return folder
    } catch {
        try? FileManager.default.removeItem(at: folder)
        throw error
    }
}

/// The size of one read or write.
private let chunkBytes = 16 << 20

/// Copies `source` to a new file at `target` and returns the original's
/// checksum. Neither file goes through the page cache, so the copy's check
/// later reads the disk.
func copyFile(
    _ source: URL,
    to target: URL,
    sizeBytes: Int64,
    isCancelled: () -> Bool,
    onBytes: (Int64) -> Void
) throws(CardImportError) -> SHA256.Digest {
    let name = source.lastPathComponent
    guard let input = try? FileHandle(forReadingFrom: source) else { throw .unreadable(fileName: name) }
    defer { try? input.close() }
    guard FileManager.default.createFile(atPath: target.path(percentEncoded: false), contents: nil),
          let output = try? FileHandle(forWritingTo: target)
    else { throw .unwritable }
    defer { try? output.close() }
    _ = fcntl(input.fileDescriptor, F_NOCACHE, 1)
    _ = fcntl(output.fileDescriptor, F_NOCACHE, 1)

    var hasher = SHA256()
    var copied: Int64 = 0
    while true {
        if isCancelled() { throw .cancelled }
        let chunk: Data
        do {
            guard let data = try input.read(upToCount: chunkBytes), !data.isEmpty else { break }
            chunk = data
        } catch {
            throw .unreadable(fileName: name)
        }
        hasher.update(data: chunk)
        do {
            try output.write(contentsOf: chunk)
        } catch {
            throw .unwritable
        }
        copied += Int64(chunk.count)
        onBytes(Int64(chunk.count))
    }
    // The card changed under the copy.
    guard copied == sizeBytes else { throw .mismatch(fileName: name) }
    // Onto the disk itself, past its own cache, before the card may go.
    guard fcntl(output.fileDescriptor, F_FULLFSYNC) == 0 || (try? output.synchronize()) != nil else {
        throw .unwritable
    }
    return hasher.finalize()
}

/// Reads the copy at `url` back and checks its size and checksum against the
/// original's.
func checkCopy(
    _ url: URL,
    name: String,
    sizeBytes: Int64,
    digest: SHA256.Digest,
    isCancelled: () -> Bool,
    onBytes: (Int64) -> Void
) throws(CardImportError) {
    guard let size = try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize, Int64(size) == sizeBytes,
          let input = try? FileHandle(forReadingFrom: url)
    else { throw .mismatch(fileName: name) }
    defer { try? input.close() }
    _ = fcntl(input.fileDescriptor, F_NOCACHE, 1)

    var hasher = SHA256()
    while true {
        if isCancelled() { throw .cancelled }
        let chunk: Data
        do {
            guard let data = try input.read(upToCount: chunkBytes), !data.isEmpty else { break }
            chunk = data
        } catch {
            throw .mismatch(fileName: name)
        }
        hasher.update(data: chunk)
        onBytes(Int64(chunk.count))
    }
    guard hasher.finalize() == digest else { throw .mismatch(fileName: name) }
}
