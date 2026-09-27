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
    let keyframe = try await keyframeTimes(atOrBeforeS: first.localStartS, in: video, fileName: first.filePath)

    // Game times in ticks of the video's timescale. The first sample in
    // decode order lands on file time 0, so the keyframe itself plays at its
    // decode lead: a file without edit lists starts where its samples start.
    let ticks = { (seconds: Double) in Int64((seconds * Double(timescale)).rounded()) }
    let originTicks = ticks(chapterStartsS[first.sourceIndex]) + CMTimeConvertScale(
        keyframe.decode, timescale: timescale, method: .roundHalfAwayFromZero
    ).value
    let offsets = plan.cuts.map { CMTime(value: ticks(chapterStartsS[$0.sourceIndex]) - originTicks, timescale: timescale) }

    let videoRuns = zip(pieces, offsets).enumerated().map { index, pair in
        TrackRun(
            asset: pair.0.asset,
            track: pair.0.video,
            from: index == 0 ? keyframe.presentation : compositionTime(pair.0.cut.localStartS),
            firstDecode: index == 0 ? keyframe.decode : nil,
            until: compositionTime(pair.0.cut.localEndS),
            offset: pair.1
        )
    }
    // Every track of a file without edit lists starts at file time 0, so the
    // sound starts there too, with the keyframe's decode time.
    let audioRuns = zip(pieces, offsets).enumerated().compactMap { index, pair in
        pair.0.audio.map {
            TrackRun(
                asset: pair.0.asset,
                track: $0,
                from: index == 0 ? keyframe.decode : compositionTime(pair.0.cut.localStartS),
                firstDecode: nil,
                until: compositionTime(pair.0.cut.localEndS),
                offset: pair.1
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
            return ChapterPiece(cut: cut, asset: asset, video: video, audio: audio)
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

/// The presentation and decode time of the last keyframe that plays at or
/// before `localS`, read from the file's sample tables without reading a
/// frame. The tables count in media time; a file with an edit list plays that
/// shifted, so the times go through the track's segments both ways.
private func keyframeTimes(
    atOrBeforeS localS: Double,
    in track: AVAssetTrack,
    fileName: String
) async throws(ClipCutError) -> (presentation: CMTime, decode: CMTime) {
    guard (try? await track.load(.canProvideSampleCursors)) == true,
          let segments = try? await track.load(.segments).filter({ !$0.isEmpty }), !segments.isEmpty
    else { throw .noKeyframe(fileName: fileName) }
    // A microsecond of slack: a keyframe exactly on the start counts.
    let trackTarget = compositionTime(localS + 0.000_001)
    let segment = segments.last { $0.timeMapping.target.start <= trackTarget } ?? segments[0]
    let shift = segment.timeMapping.target.start - segment.timeMapping.source.start
    let target = trackTarget - shift
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
    return (cursor.presentationTimeStamp + shift, decode + shift)
}

/// One chapter's samples of one track: those from `from` on, until `until`,
/// moved by `offset` onto the clip's timeline.
private struct TrackRun: @unchecked Sendable {
    let asset: AVAsset
    let track: AVAssetTrack
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
        while runIndex < runs.count {
            let run = runs[runIndex]
            if output == nil {
                guard let opened = open(run) else { return nil }
                output = opened
            }
            while let sample = output?.copyNextSampleBuffer() {
                if let placed = place(sample, of: run) { return placed }
            }
            if reader?.status == .failed { return nil }
            reader = nil
            output = nil
            runIndex += 1
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
        reader.timeRange = CMTimeRange(start: run.from, end: run.until + CMTime(value: 1, timescale: 1))
        guard reader.startReading() else { return nil }
        self.reader = reader
        return output
    }

    /// The samples of `buffer` that belong to the run, moved onto the clip's
    /// timeline, or `nil` when none does. Video keeps every sample decoded from
    /// the keyframe on until one is decoded at the end, so each frame kept has
    /// what it is decoded from; sound keeps the packets that play inside the
    /// run, and one buffer carries many of them.
    private func place(_ buffer: CMSampleBuffer, of run: TrackRun) -> CMSampleBuffer? {
        var kept: Range<Int>?
        for index in 0..<buffer.numSamples {
            guard let timing = try? buffer.sampleTimingInfo(at: index), timing.presentationTimeStamp.isNumeric else { continue }
            let presentation = timing.presentationTimeStamp
            let decode = timing.decodeTimeStamp.isNumeric ? timing.decodeTimeStamp : presentation
            let inside = if isVideo {
                decode < run.until && (run.firstDecode.map { decode >= $0 && presentation >= run.from } ?? true)
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
