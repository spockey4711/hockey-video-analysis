import Foundation
import HockeyCore
import HockeyMedia
import HockeyStore

/// Cuts a clip file; the passthrough cutter in the app, a fake in tests.
public protocol ClipCutting: Sendable {
    func cut(_ plan: ClipCutPlan, durationsS: [Double], folder: URL, to output: URL) async throws -> CutClipFile
}

/// The Mac's cutter (ADR 0013): samples copied as they are, no edit lists.
public struct PassthroughCutter: ClipCutting {
    public init() {}

    public func cut(_ plan: ClipCutPlan, durationsS: [Double], folder: URL, to output: URL) async throws -> CutClipFile {
        try await cutClip(plan, durationsS: durationsS, folder: folder, to: output)
    }
}

/// What the clip work is doing, for the views.
public enum ClipActivity: Equatable, Sendable {
    case idle
    case cutting(clipID: UUID)
    /// `fraction` of the file is on the server.
    case uploading(clipID: UUID, fraction: Double)
}

/// Why a pass over the waiting clips ended.
enum ClipPassEnd: Equatable {
    /// Every clip that could go went; `missingMedia` clips wait for the
    /// disk their game's chapter files are on.
    case done(missingMedia: Int)
    /// The coach wants no work on battery, and the Mac runs on it.
    case paused
}

/// One pass over the clips waiting for this Mac (ADR 0013, Mac plan M6),
/// one clip at a time: cut the tag's window from the local chapter files,
/// upload the file in chunks the server can resume (S5), then hand it to the
/// clip worker with the tag version it was cut from. A file cut from a window
/// the server no longer has is thrown away and cut again once the tag's new
/// window reaches this Mac.
struct ClipWorker: Sendable {
    let store: LocalStore
    let client: APIClient
    /// Where the cut files wait for their upload.
    let folder: URL
    let windows: TagWindows
    let cutter: any ClipCutting
    var chunkBytes = 8 << 20
    let shouldPause: @Sendable () -> Bool
    let report: @MainActor @Sendable (ClipActivity) -> Void

    private enum Step {
        case next
        case missingMedia
        case paused
    }

    func run() async throws -> ClipPassEnd {
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try removeLeftovers()
        var missingMedia = 0
        for job in try store.clipJobs() {
            if shouldPause() { return .paused }
            switch try await process(job) {
            case .next: continue
            case .missingMedia: missingMedia += 1
            case .paused: return .paused
            }
        }
        return .done(missingMedia: missingMedia)
    }

    /// Removes the files no clip needs any more: sent, thrown away, or left
    /// half-written when the app quit.
    private func removeLeftovers() throws {
        let needed = try store.clipFileNames()
        let names = try FileManager.default.contentsOfDirectory(atPath: folder.path(percentEncoded: false))
        for name in names where !needed.contains(name) {
            try? FileManager.default.removeItem(at: folder.appending(path: name))
        }
    }

    private func process(_ job: ClipJob) async throws -> Step {
        let endS: Double
        do {
            endS = try resolveClipEnd(startS: job.tag.startS, endS: job.tag.endS, type: job.tag.type, windows: windows)
        } catch {
            try store.holdClip(job.id, untilTagVersion: job.tagVersion + 1)
            return .next
        }

        var cut = job.cut
        var uploadID = job.uploadID
        if let current = cut, current.tagStartS != job.tag.startS || current.endS != endS || !exists(current) {
            try await abandon(job.id, uploadID)
            cut = nil
            uploadID = nil
        }
        if cut == nil {
            switch try await makeCut(job, endS: endS) {
            case let .made(made): cut = made
            case let .stop(step): return step
            }
        }
        guard let cut else { return .next }
        return try await send(job, cut, uploadID: uploadID)
    }

    // MARK: Cutting

    private enum CutOutcome {
        case made(ClipCut)
        case stop(Step)
    }

    private func makeCut(_ job: ClipJob, endS: Double) async throws -> CutOutcome {
        guard let media = chapterFolder(job.folderBookmark) else { return .stop(.missingMedia) }
        let sources = job.chapters.enumerated().map {
            ClipSource(orderIndex: $0.offset, filePath: $0.element.fileName, durationS: $0.element.durationS)
        }
        let plan: ClipCutPlan
        do {
            plan = try planClipCut(sources, startS: job.tag.startS, endS: endS)
        } catch {
            // A window past the game's end, which no cutter can serve.
            try store.holdClip(job.id, untilTagVersion: job.tagVersion + 1)
            return .stop(.next)
        }

        await report(.cutting(clipID: job.id))
        let name = "\(job.id.storedName).mp4"
        let file: CutClipFile
        do {
            file = try await cutter.cut(plan, durationsS: job.chapters.map(\.durationS), folder: media, to: folder.appending(path: name))
        } catch ClipCutError.unreadable {
            return .stop(.missingMedia)
        } catch {
            try store.holdClip(job.id, untilTagVersion: job.tagVersion + 1)
            return .stop(.next)
        }
        let cut = ClipCut(fileName: name, tagStartS: job.tag.startS, endS: endS, cutStartS: file.cutStartS, sizeBytes: file.sizeBytes)
        try store.recordCut(cut, ofClip: job.id)
        return .made(cut)
    }

    /// The folder a bookmark leads to, while its disk is there.
    private func chapterFolder(_ bookmark: Data?) -> URL? {
        guard let bookmark else { return nil }
        var isStale = false
        guard let url = try? URL(resolvingBookmarkData: bookmark, options: [.withoutUI], bookmarkDataIsStale: &isStale),
              FileManager.default.fileExists(atPath: url.path(percentEncoded: false))
        else { return nil }
        return url
    }

    private func exists(_ cut: ClipCut) -> Bool {
        FileManager.default.fileExists(atPath: folder.appending(path: cut.fileName).path(percentEncoded: false))
    }

    // MARK: Uploading

    private func send(_ job: ClipJob, _ cut: ClipCut, uploadID: UUID?) async throws -> Step {
        var uploadID = uploadID
        var offset: Int64 = 0
        if let known = uploadID {
            let answer = try await client.send("HEAD", "api/app/v1/uploads/\(known.wire)")
            if answer.status == 200, let held = answer.byteCount("Upload-Offset") {
                offset = held
            } else {
                uploadID = nil
            }
        }
        if uploadID == nil {
            let answer = try await client.send(
                "POST",
                "api/app/v1/uploads",
                body: UploadBody(targetId: job.id.wire, sizeBytes: cut.sizeBytes)
            )
            switch answer.status {
            case 201:
                let upload = try answer.decode(UploadEnvelope.self).upload
                uploadID = upload.id
                offset = upload.offset
                try store.recordUpload(upload.id, ofClip: job.id)
            case 503:
                // Uploads are off on the server; the next pass asks again.
                return .next
            default:
                // The clip is gone or not this Mac's to cut; the next pull says.
                try await refuse(job, nil)
                return .next
            }
        }
        guard let uploadID else { return .next }

        let handle = try FileHandle(forReadingFrom: folder.appending(path: cut.fileName))
        defer { try? handle.close() }
        var stalls = 0
        while offset < cut.sizeBytes {
            // A server that keeps its offset where it was waits for a later pass.
            guard stalls < 3 else { return .next }
            if shouldPause() { return .paused }
            await report(.uploading(clipID: job.id, fraction: Double(offset) / Double(cut.sizeBytes)))
            try handle.seek(toOffset: UInt64(offset))
            let chunk = try handle.read(upToCount: min(chunkBytes, Int(cut.sizeBytes - offset))) ?? Data()
            guard !chunk.isEmpty else { throw SyncError.invalidAnswer }
            let answer = try await client.send(
                "PATCH",
                "api/app/v1/uploads/\(uploadID.wire)",
                bytes: chunk,
                headers: ["Upload-Offset": String(offset)]
            )
            let before = offset
            let held = answer.byteCount("Upload-Offset")
            switch answer.status {
            case 204:
                offset = held ?? offset + Int64(chunk.count)
            case 400 where held != nil, 409 where held != nil:
                // Stored in part, or the server stands elsewhere: go on from
                // where it is.
                offset = held ?? offset
            case 404:
                // Expired: a new upload next pass.
                try store.recordUpload(nil, ofClip: job.id)
                return .next
            case 409:
                // No longer receiving: it was handed off already.
                offset = cut.sizeBytes
            default:
                try await refuse(job, uploadID)
                return .next
            }
            stalls = offset > before ? 0 : stalls + 1
        }
        await report(.uploading(clipID: job.id, fraction: 1))
        return try await handOff(job, cut, uploadID)
    }

    // MARK: Handing off

    private func handOff(_ job: ClipJob, _ cut: ClipCut, _ uploadID: UUID, tagVersion: Int? = nil, attempt: Int = 0) async throws -> Step {
        guard attempt < 3 else { return .next }
        let version = tagVersion ?? job.tagVersion
        let answer = try await client.send(
            "POST",
            "api/app/v1/clips/\(job.id.wire)/file",
            body: ClipFileBody(uploadId: uploadID.wire, tagVersion: version, cutStartS: cut.cutStartS)
        )
        switch answer.status {
        case 202:
            try store.settleHandOff(ofClip: job.id)
            try? FileManager.default.removeItem(at: folder.appending(path: cut.fileName))
            return .next
        case 409:
            if let moved = try? answer.decode(MovedTagEnvelope.self).tag {
                // Only the players or the version moved: the file still holds
                // the window, so it goes with the new version.
                let movedEnd = try? resolveClipEnd(startS: moved.startS, endS: moved.endS, type: moved.type, windows: windows)
                if moved.startS == cut.tagStartS, movedEnd == cut.endS {
                    return try await handOff(job, cut, uploadID, tagVersion: moved.version, attempt: attempt + 1)
                }
                try store.holdClip(job.id, untilTagVersion: moved.version)
                try await abandon(job.id, uploadID)
            } else if (try? answer.decode(OffsetPayload.self)) != nil {
                // Bytes are missing after all: the next pass resumes.
                return .next
            } else if (try? answer.decode(ClipEnvelope.self)) != nil {
                // The clip is not waiting for a file any more.
                try store.settleHandOff(ofClip: job.id)
                try await abandon(job.id, uploadID)
            } else {
                // The upload was used before: the next pass sends it anew.
                try store.recordUpload(nil, ofClip: job.id)
            }
            return .next
        case 404:
            if (try? answer.decode(ErrorPayload.self).error.contains("upload")) == true {
                try store.recordUpload(nil, ofClip: job.id)
            } else {
                try store.settleHandOff(ofClip: job.id)
                try await abandon(job.id, uploadID)
            }
            return .next
        default:
            try await refuse(job, uploadID)
            return .next
        }
    }

    /// The server refused the file for good: the clip waits for its tag to
    /// change before it is cut again.
    private func refuse(_ job: ClipJob, _ uploadID: UUID?) async throws {
        try store.holdClip(job.id, untilTagVersion: job.tagVersion + 1)
        try await abandon(job.id, uploadID)
    }

    /// Throws a clip's file and upload away.
    private func abandon(_ clipID: UUID, _ uploadID: UUID?) async throws {
        if let uploadID { _ = try? await client.send("DELETE", "api/app/v1/uploads/\(uploadID.wire)") }
        try store.dropCut(ofClip: clipID)
        try removeLeftovers()
    }
}

extension UUID {
    /// A file name made from the id.
    var storedName: String { uuidString.lowercased() }
}
