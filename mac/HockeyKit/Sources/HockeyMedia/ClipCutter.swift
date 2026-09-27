import AVFoundation
import HockeyCore

/// Cutting a clip on the Mac (ADR 0013): the samples of the game's own chapter
/// files are copied as they are, never decoded or encoded again, so a Mac clip
/// is full resolution like a server clip (ADR 0004).
///
/// The clip starts on the keyframe at or before the tag start, so it plays
/// from its first frame, and joins one piece per chapter along the shared cut
/// plan. Every sample keeps its place on the game timeline: file time `t` is
/// game time `cutStartS + t`, across a seam too. The file has no MP4 edit
/// lists, which browsers read differently; it starts with its first sample.

/// A clip file the cutter wrote.
public struct CutClipFile: Equatable, Sendable {
    public let url: URL
    /// The game time at file time 0 (`clips.cut_start_s`): at or before the tag
    /// start, by the distance to the keyframe the clip starts on.
    public let cutStartS: Double
    public let sizeBytes: Int64

    public init(url: URL, cutStartS: Double, sizeBytes: Int64) {
        self.url = url
        self.cutStartS = cutStartS
        self.sizeBytes = sizeBytes
    }
}

/// Why a clip cannot be cut.
public enum ClipCutError: Error, Equatable, Sendable {
    /// A chapter file is missing or AVFoundation cannot read it.
    case unreadable(fileName: String)
    /// A chapter has no video track.
    case noVideo(fileName: String)
    /// No keyframe lies at or before the clip's start.
    case noKeyframe(fileName: String)
    /// The clip file could not be written.
    case writeFailed
}

/// Cuts `plan` from the chapter files in `folder` into a new MP4 at `output`.
/// `durationsS` are the game's stored chapter durations, which place each
/// chapter on the game timeline.
public func cutClip(
    _ plan: ClipCutPlan,
    durationsS: [Double],
    folder: URL,
    to output: URL
) async throws(ClipCutError) -> CutClipFile {
    guard let first = plan.cuts.first else { throw .writeFailed }
    var chapterStartsS = [0.0]
    for duration in durationsS { chapterStartsS.append(chapterStartsS[chapterStartsS.count - 1] + duration) }
    guard plan.cuts.allSatisfy({ $0.sourceIndex < durationsS.count }) else { throw .writeFailed }

    var pieces: [ChapterPiece] = []
    for cut in plan.cuts {
        try await pieces.append(ChapterPiece.open(cut, folder: folder))
    }
    let video = pieces[0].video
    let timescale = try await loadTimescale(video, fileName: first.filePath)
    let keyframe = try await keyframeTimes(atOrBeforeS: first.localStartS, in: video, shift: pieces[0].videoShift, fileName: first.filePath)

    // Game times in ticks of the video's timescale. The first sample in
    // decode order lands on file time 0, so the keyframe itself plays at its
    // decode lead: a file without edit lists starts where its samples start.
    let ticks = { (seconds: Double) in Int64((seconds * Double(timescale)).rounded()) }
    let inTicks = { (time: CMTime) in CMTimeConvertScale(time, timescale: timescale, method: .roundHalfAwayFromZero).value }
    let originTicks = ticks(chapterStartsS[first.sourceIndex]) + inTicks(keyframe.decode + pieces[0].videoShift)
    // From a chapter's track time onto the clip's timeline.
    let offsets = plan.cuts.map { CMTime(value: ticks(chapterStartsS[$0.sourceIndex]) - originTicks, timescale: timescale) }

    let videoRuns = zip(pieces, offsets).enumerated().map { index, pair in
        let (piece, offset) = pair
        return TrackRun(
            asset: piece.asset,
            track: piece.video,
            shift: piece.videoShift,
            from: index == 0 ? keyframe.presentation : compositionTime(piece.cut.localStartS) - piece.videoShift,
            firstDecode: index == 0 ? keyframe.decode : nil,
            until: compositionTime(piece.cut.localEndS) - piece.videoShift,
            offset: offset + piece.videoShift
        )
    }
    // Every track of a file without edit lists starts at file time 0, so the
    // sound starts there too, with the keyframe's decode time.
    let audioRuns = zip(pieces, offsets).enumerated().compactMap { index, pair in
        let (piece, offset) = pair
        return piece.audio.map {
            TrackRun(
                asset: piece.asset,
                track: $0,
                shift: piece.audioShift,
                from: (index == 0 ? keyframe.decode + piece.videoShift : compositionTime(piece.cut.localStartS)) - piece.audioShift,
                firstDecode: nil,
                until: compositionTime(piece.cut.localEndS) - piece.audioShift,
                offset: offset + piece.audioShift
            )
        }
    }

    let temporary = output.deletingLastPathComponent()
        .appending(path: ".\(output.lastPathComponent).\(UUID().uuidString).part")
    defer { try? FileManager.default.removeItem(at: temporary) }
    try await write(video: videoRuns, audio: audioRuns, timescale: timescale, to: temporary)
    do {
        try stripEditLists(at: temporary)
        _ = try? FileManager.default.removeItem(at: output)
        try FileManager.default.moveItem(at: temporary, to: output)
    } catch {
        throw .writeFailed
    }
    let size = (try? output.resourceValues(forKeys: [.fileSizeKey]).fileSize).flatMap { $0 } ?? 0
    return CutClipFile(url: output, cutStartS: Double(originTicks) / Double(timescale), sizeBytes: Int64(size))
}

/// One chapter's tracks for one piece of the plan.
private struct ChapterPiece {
    let cut: ClipSourceCut
    /// Held here: a track only keeps a weak reference to its asset.
    let asset: AVAsset
    let video: AVAssetTrack
    let audio: AVAssetTrack?
    /// How far each track's edit list moves its samples: a sample stamped
    /// `t` plays at track time `t + shift`.
    let videoShift: CMTime
    let audioShift: CMTime

    static func open(_ cut: ClipSourceCut, folder: URL) async throws(ClipCutError) -> ChapterPiece {
        let url = folder.appending(path: cut.filePath)
        guard FileManager.default.isReadableFile(atPath: url.path(percentEncoded: false)) else {
            throw .unreadable(fileName: cut.filePath)
        }
        let asset = openChapterAsset(url)
        do {
            guard let video = try await asset.loadTracks(withMediaType: .video).first else {
                throw ClipCutError.noVideo(fileName: cut.filePath)
            }
            let audio = try await asset.loadTracks(withMediaType: .audio).first
            let audioShift = if let audio { try await editShift(of: audio) } else { CMTime.zero }
            return try await ChapterPiece(
                cut: cut,
                asset: asset,
                video: video,
                audio: audio,
                videoShift: editShift(of: video),
                audioShift: audioShift
            )
        } catch let error as ClipCutError {
            throw error
        } catch {
            throw .unreadable(fileName: cut.filePath)
        }
    }
}

private func loadTimescale(_ track: AVAssetTrack, fileName: String) async throws(ClipCutError) -> CMTimeScale {
    guard let timescale = try? await track.load(.naturalTimeScale), timescale > 0 else {
        throw .unreadable(fileName: fileName)
    }
    return timescale
}

/// How far a track's edit list moves its samples, from its first segment
/// that shows media. The sample tables and a passthrough reader stamp samples
/// in media time; the game timeline runs in track time.
private func editShift(of track: AVAssetTrack) async throws -> CMTime {
    guard let segment = try await track.load(.segments).first(where: { !$0.isEmpty }) else { return .zero }
    return segment.timeMapping.target.start - segment.timeMapping.source.start
}

/// The presentation and decode time, in media time, of the last keyframe that
/// plays at or before track time `localS`, read from the file's sample tables
/// without reading a frame.
private func keyframeTimes(
    atOrBeforeS localS: Double,
    in track: AVAssetTrack,
    shift: CMTime,
    fileName: String
) async throws(ClipCutError) -> (presentation: CMTime, decode: CMTime) {
    guard (try? await track.load(.canProvideSampleCursors)) == true else { throw .noKeyframe(fileName: fileName) }
    // A microsecond of slack: a keyframe exactly on the start counts.
    let target = compositionTime(localS + 0.000_001) - shift
    guard let cursor = track.makeSampleCursor(presentationTimeStamp: target) else {
        throw .noKeyframe(fileName: fileName)
    }
    while cursor.presentationTimeStamp > target {
        guard cursor.stepInPresentationOrder(byCount: -1) == -1 else { throw .noKeyframe(fileName: fileName) }
    }
    while !(cursor.currentSampleSyncInfo.sampleIsFullSync.boolValue && cursor.presentationTimeStamp <= target) {
        guard cursor.stepInDecodeOrder(byCount: -1) == -1 else { throw .noKeyframe(fileName: fileName) }
    }
    let decode = cursor.decodeTimeStamp.isNumeric ? cursor.decodeTimeStamp : cursor.presentationTimeStamp
    return (cursor.presentationTimeStamp, decode)
}

/// One chapter's samples of one track: those from `from` on, until `until`,
/// moved by `offset` onto the clip's timeline. The times are the samples' own
/// (media time); `shift` turns them into the track time a reader's range is in.
private struct TrackRun: @unchecked Sendable {
    let asset: AVAsset
    let track: AVAssetTrack
    let shift: CMTime
    let from: CMTime
    /// The decode time of the keyframe the clip starts on; samples decoded
    /// before it belong to the frames before the clip.
    let firstDecode: CMTime?
    let until: CMTime
    let offset: CMTime
}

/// Writes the runs of each track, one after another, into one MP4.
private func write(video: [TrackRun], audio: [TrackRun], timescale: CMTimeScale, to url: URL) async throws(ClipCutError) {
    let writer: AVAssetWriter
    do {
        writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
    } catch {
        throw .writeFailed
    }
    // The movie header goes first, so a browser starts playing before the
    // whole clip has loaded.
    writer.shouldOptimizeForNetworkUse = true

    var copies: [TrackCopy] = []
    do {
        let (format, transform) = try await video[0].track.load(.formatDescriptions, .preferredTransform)
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: nil, sourceFormatHint: format.first)
        input.expectsMediaDataInRealTime = false
        input.mediaTimeScale = timescale
        input.transform = transform
        writer.add(input)
        copies.append(TrackCopy(input: input, runs: video, isVideo: true))
        if let first = audio.first {
            let formats = try await first.track.load(.formatDescriptions)
            let input = AVAssetWriterInput(mediaType: .audio, outputSettings: nil, sourceFormatHint: formats.first)
            input.expectsMediaDataInRealTime = false
            writer.add(input)
            copies.append(TrackCopy(input: input, runs: audio, isVideo: false))
        }
    } catch {
        throw .writeFailed
    }

    guard writer.startWriting() else { throw .writeFailed }
    writer.startSession(atSourceTime: .zero)
    var failed = false
    for copy in copies {
        copy.start()
    }
    for copy in copies {
        if await !copy.finished() { failed = true }
    }
    if failed {
        writer.cancelWriting()
        throw .writeFailed
    }
    // Without an end the writer ends the session with the last sample it was
    // given in decode order, and drops reordered frames that show after it.
    writer.endSession(atSourceTime: CMTime(value: 100, timescale: 1))
    await writer.finishWriting()
    guard writer.status == .completed else { throw .writeFailed }
}

/// Copies one track's runs into its writer input from its own queue, whenever
/// the writer asks for more, so the video and sound interleave on their own.
private final class TrackCopy: @unchecked Sendable {
    private let input: AVAssetWriterInput
    private let runs: [TrackRun]
    private let isVideo: Bool
    private let queue: DispatchQueue
    private let done: AsyncStream<Bool>
    private let signal: AsyncStream<Bool>.Continuation
    /// Touched only on `queue`.
    private var runIndex = 0
    private var reader: AVAssetReader?
    private var output: AVAssetReaderTrackOutput?
    private var lastDecode = CMTime.negativeInfinity
    /// When the latest sample written stops showing.
    private(set) var presentationEnd = CMTime.zero
    /// Frames that show past the run's end, until it is clear whether a
    /// frame that shows in time needs them.
    private var held: [CMSampleBuffer] = []
    /// Samples placed and waiting to go in.
    private var ready: [CMSampleBuffer] = []
    /// When the latest frame kept from the run's end shows.
    private var shownUntil = CMTime.negativeInfinity
    private var isDone = false

    init(input: AVAssetWriterInput, runs: [TrackRun], isVideo: Bool) {
        self.input = input
        self.runs = runs
        self.isVideo = isVideo
        queue = DispatchQueue(label: isVideo ? "clip.video" : "clip.audio")
        (done, signal) = AsyncStream.makeStream()
    }

    func start() {
        input.requestMediaDataWhenReady(on: queue) { [self] in feed() }
    }

    /// Whether every sample went in.
    func finished() async -> Bool {
        for await ok in done { return ok }
        return false
    }

    private func feed() {
        while !isDone, input.isReadyForMoreMediaData {
            guard let sample = nextSample() else { return finish(runIndex >= runs.count) }
            guard input.append(sample) else { return finish(false) }
            let end = sample.presentationTimeStamp + (sample.duration.isNumeric ? sample.duration : .zero)
            presentationEnd = max(presentationEnd, end)
        }
    }

    private func finish(_ ok: Bool) {
        guard !isDone else { return }
        isDone = true
        reader?.cancelReading()
        input.markAsFinished()
        signal.yield(ok)
        signal.finish()
    }

    /// The next sample on the clip's timeline, opening each run's reader in
    /// turn; `nil` once every run is copied, or a reader failed.
    private func nextSample() -> CMSampleBuffer? {
        if !ready.isEmpty { return ready.removeFirst() }
        while runIndex < runs.count {
            let run = runs[runIndex]
            if output == nil {
                guard let opened = open(run) else { return nil }
                output = opened
            }
            while let sample = output?.copyNextSampleBuffer() {
                if isVideo {
                    guard sample.presentationTimeStamp.isNumeric else { continue }
                    // From a keyframe decoded at the end on, nothing shows in time.
                    if sample.decodeTime >= run.until, sample.isKeyframe { break }
                    // A frame that shows at or past the end goes in only when
                    // a frame that shows in time is decoded after it, and may
                    // depend on it; else the clip would end on a skip.
                    if sample.presentationTimeStamp >= run.until {
                        held.append(sample)
                        continue
                    }
                    ready = (held + [sample]).compactMap { place($0, of: run) }
                    shownUntil = max(shownUntil, (held + [sample]).map(\.presentationTimeStamp).max() ?? shownUntil)
                    held = []
                    if !ready.isEmpty { return ready.removeFirst() }
                    continue
                }
                if let placed = place(sample, of: run) { return placed }
            }
            if reader?.status == .failed { return nil }
            reader?.cancelReading()
            reader = nil
            output = nil
            // A frame that shows past the end went in as a reference: the
            // frames that show before it go in too, so the clip ends without
            // a skip.
            ready = held.filter { $0.presentationTimeStamp < shownUntil }.compactMap { place($0, of: run) }
            held = []
            shownUntil = .negativeInfinity
            runIndex += 1
            if !ready.isEmpty { return ready.removeFirst() }
        }
        return nil
    }

    private func open(_ run: TrackRun) -> AVAssetReaderTrackOutput? {
        guard let reader = try? AVAssetReader(asset: run.asset) else { return nil }
        let output = AVAssetReaderTrackOutput(track: run.track, outputSettings: nil)
        output.alwaysCopiesSampleData = false
        guard reader.canAdd(output) else { return nil }
        reader.add(output)
        // A little past the end: a frame decoded before the end may show
        // after it, and the video keeps whole decode runs (below).
        reader.timeRange = CMTimeRange(start: run.from + run.shift, end: run.until + run.shift + CMTime(value: 1, timescale: 1))
        guard reader.startReading() else { return nil }
        self.reader = reader
        return output
    }

    /// The samples of `buffer` that belong to the run, moved onto the clip's
    /// timeline, or `nil` when none does. Video keeps every sample decoded from
    /// the keyframe on (the end is `nextSample`'s), so each frame kept has what
    /// it is decoded from; sound keeps the packets that play inside the run,
    /// and one buffer carries many of them.
    private func place(_ buffer: CMSampleBuffer, of run: TrackRun) -> CMSampleBuffer? {
        var kept: Range<Int>?
        for index in 0..<buffer.numSamples {
            guard let timing = try? buffer.sampleTimingInfo(at: index), timing.presentationTimeStamp.isNumeric else { continue }
            let presentation = timing.presentationTimeStamp
            let decode = timing.decodeTimeStamp.isNumeric ? timing.decodeTimeStamp : presentation
            let inside = if isVideo {
                run.firstDecode.map { decode >= $0 && presentation >= run.from } ?? true
            } else {
                presentation >= run.from && presentation < run.until
            }
            guard inside else { continue }
            kept = kept.map { $0.lowerBound..<index + 1 } ?? index..<index + 1
        }
        guard let kept else { return nil }
        var sample = buffer
        if kept.count < buffer.numSamples {
            var part: CMSampleBuffer?
            let range = CFRange(location: kept.lowerBound, length: kept.count)
            guard CMSampleBufferCopySampleBufferForRange(
                allocator: nil, sampleBuffer: buffer, sampleRange: range, sampleBufferOut: &part
            ) == noErr, let part else { return nil }
            sample = part
        }

        guard var timings = try? sample.sampleTimingInfos() else { return nil }
        for index in timings.indices {
            timings[index].presentationTimeStamp = timings[index].presentationTimeStamp + run.offset
            if timings[index].decodeTimeStamp.isNumeric {
                timings[index].decodeTimeStamp = timings[index].decodeTimeStamp + run.offset
            }
        }
        guard let placed = try? CMSampleBuffer(copying: sample, withNewTiming: timings) else { return nil }
        let placedDecode = placed.decodeTimeStamp.isNumeric ? placed.decodeTimeStamp : placed.presentationTimeStamp
        // Two chapters can meet with decode times that touch; the writer
        // needs them to grow.
        guard placedDecode > lastDecode else { return nil }
        lastDecode = placedDecode
        // Encoder priming the source trims by an edit would come back as an
        // edit list; the clip keeps its sound as it is.
        CMRemoveAttachment(placed, key: kCMSampleBufferAttachmentKey_TrimDurationAtStart)
        CMRemoveAttachment(placed, key: kCMSampleBufferAttachmentKey_TrimDurationAtEnd)
        return placed
    }
}

extension CMSampleBuffer {
    var decodeTime: CMTime {
        decodeTimeStamp.isNumeric ? decodeTimeStamp : presentationTimeStamp
    }

    /// Whether the sample decodes on its own.
    var isKeyframe: Bool {
        let attachments = CMSampleBufferGetSampleAttachmentsArray(self, createIfNecessary: false) as? [[CFString: Any]]
        return attachments?.first?[kCMSampleAttachmentKey_NotSync] as? Bool != true
    }
}
