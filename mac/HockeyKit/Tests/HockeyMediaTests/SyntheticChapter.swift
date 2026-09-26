import AVFoundation
import CoreVideo
import Foundation

/// Writes short synthetic chapter files for the media tests: a small H.264
/// picture whose brightness changes every frame, and optionally a silent AAC
/// track that may run longer than the video, as a GoPro's audio does. No
/// footage ever lives in the repository (ADR 0013).
enum SyntheticChapter {
    struct Failure: Error, CustomStringConvertible {
        let description: String
    }

    static let width = 160
    static let height = 90
    static let sampleRate = 48_000.0
    static let samplesPerBuffer = 1_024

    /// Writes `frames` frames at `fps`, and `audioS` seconds of silence when
    /// given, into an MP4 at `url`.
    static func write(to url: URL, frames: Int, fps: Int32, audioS: Double? = nil) async throws {
        let writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
        let video = AVAssetWriterInput(
            mediaType: .video,
            outputSettings: [
                AVVideoCodecKey: AVVideoCodecType.h264,
                AVVideoWidthKey: width,
                AVVideoHeightKey: height,
            ]
        )
        video.expectsMediaDataInRealTime = false
        video.mediaTimeScale = CMTimeScale(fps) * 100
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(
            assetWriterInput: video,
            sourcePixelBufferAttributes: [
                kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
                kCVPixelBufferWidthKey as String: width,
                kCVPixelBufferHeightKey as String: height,
            ]
        )
        writer.add(video)

        var audio: AVAssetWriterInput?
        if audioS != nil {
            let input = AVAssetWriterInput(
                mediaType: .audio,
                outputSettings: [
                    AVFormatIDKey: kAudioFormatMPEG4AAC,
                    AVSampleRateKey: sampleRate,
                    AVNumberOfChannelsKey: 1,
                    AVEncoderBitRateKey: 64_000,
                ]
            )
            input.expectsMediaDataInRealTime = false
            writer.add(input)
            audio = input
        }

        guard writer.startWriting() else {
            throw Failure(description: "cannot start writing: \(String(describing: writer.error))")
        }
        writer.startSession(atSourceTime: .zero)

        // Each track is fed on its own queue whenever the writer asks for it,
        // the pattern AVAssetWriter documents, so its interleaving never waits
        // on a track nobody is feeding.
        let totalSamples = Int(((audioS ?? 0) * sampleRate).rounded())
        var feeds = [
            Feed(input: video, queue: DispatchQueue(label: "synthetic.video"), count: frames) { frame in
                let buffer = try pixelBuffer(pool: adaptor.pixelBufferPool, shade: UInt8(frame % 256))
                return adaptor.append(buffer, withPresentationTime: CMTime(value: CMTimeValue(frame), timescale: fps))
            },
        ]
        if let audio {
            let buffers = (totalSamples + samplesPerBuffer - 1) / samplesPerBuffer
            feeds.append(Feed(input: audio, queue: DispatchQueue(label: "synthetic.audio"), count: buffers) { index in
                let sample = index * samplesPerBuffer
                return audio.append(try silence(at: sample, count: min(samplesPerBuffer, totalSamples - sample)))
            })
        }
        for feed in feeds {
            try await feed.run()
        }
        await writer.finishWriting()
        guard writer.status == .completed else {
            throw Failure(description: "cannot finish writing: \(String(describing: writer.error))")
        }
    }

    /// Feeds one writer input from its own queue until `count` samples are in.
    private final class Feed: @unchecked Sendable {
        let input: AVAssetWriterInput
        let queue: DispatchQueue
        let count: Int
        let append: (Int) throws -> Bool
        /// Touched only on `queue`.
        private var next = 0
        private let done: AsyncThrowingStream<Void, Error>
        private let signal: AsyncThrowingStream<Void, Error>.Continuation

        init(input: AVAssetWriterInput, queue: DispatchQueue, count: Int, append: @escaping (Int) throws -> Bool) {
            self.input = input
            self.queue = queue
            self.count = count
            self.append = append
            (done, signal) = AsyncThrowingStream.makeStream()
            input.requestMediaDataWhenReady(on: queue) { [self] in feed() }
        }

        /// Returns once every sample is in, or throws the first failure.
        func run() async throws {
            for try await _ in done {}
        }

        private func feed() {
            while input.isReadyForMoreMediaData, next < count {
                do {
                    guard try append(next) else {
                        return finish(Failure(description: "cannot append sample \(next)"))
                    }
                } catch {
                    return finish(error)
                }
                next += 1
            }
            if next == count { finish(nil) }
        }

        private func finish(_ error: Error?) {
            guard next <= count else { return }
            next = count + 1
            input.markAsFinished()
            signal.finish(throwing: error)
        }
    }

    private static func pixelBuffer(pool: CVPixelBufferPool?, shade: UInt8) throws -> CVPixelBuffer {
        var buffer: CVPixelBuffer?
        guard let pool, CVPixelBufferPoolCreatePixelBuffer(nil, pool, &buffer) == kCVReturnSuccess, let buffer else {
            throw Failure(description: "no pixel buffer")
        }
        CVPixelBufferLockBaseAddress(buffer, [])
        defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
        if let base = CVPixelBufferGetBaseAddress(buffer) {
            memset(base, Int32(shade), CVPixelBufferGetBytesPerRow(buffer) * height)
        }
        return buffer
    }

    private static func silence(at sample: Int, count: Int) throws -> CMSampleBuffer {
        var description = AudioStreamBasicDescription(
            mSampleRate: sampleRate,
            mFormatID: kAudioFormatLinearPCM,
            mFormatFlags: kLinearPCMFormatFlagIsSignedInteger | kLinearPCMFormatFlagIsPacked,
            mBytesPerPacket: 2,
            mFramesPerPacket: 1,
            mBytesPerFrame: 2,
            mChannelsPerFrame: 1,
            mBitsPerChannel: 16,
            mReserved: 0
        )
        var format: CMAudioFormatDescription?
        CMAudioFormatDescriptionCreate(
            allocator: nil, asbd: &description, layoutSize: 0, layout: nil,
            magicCookieSize: 0, magicCookie: nil, extensions: nil, formatDescriptionOut: &format
        )
        let bytes = count * 2
        var block: CMBlockBuffer?
        CMBlockBufferCreateWithMemoryBlock(
            allocator: nil, memoryBlock: nil, blockLength: bytes, blockAllocator: nil,
            customBlockSource: nil, offsetToData: 0, dataLength: bytes,
            flags: kCMBlockBufferAssureMemoryNowFlag, blockBufferOut: &block
        )
        guard let format, let block else { throw Failure(description: "no audio buffer") }
        CMBlockBufferFillDataBytes(with: 0, blockBuffer: block, offsetIntoDestination: 0, dataLength: bytes)
        var buffer: CMSampleBuffer?
        CMAudioSampleBufferCreateReadyWithPacketDescriptions(
            allocator: nil, dataBuffer: block, formatDescription: format, sampleCount: count,
            presentationTimeStamp: CMTime(value: CMTimeValue(sample), timescale: CMTimeScale(sampleRate)),
            packetDescriptions: nil, sampleBufferOut: &buffer
        )
        guard let buffer else { throw Failure(description: "no audio sample buffer") }
        return buffer
    }
}

/// A fresh temporary folder, removed when the test is done with it.
final class TemporaryFolder {
    let url: URL

    init() throws {
        url = FileManager.default.temporaryDirectory
            .appending(path: "HockeyMediaTests-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    }

    deinit {
        try? FileManager.default.removeItem(at: url)
    }

    /// Creates a subfolder, with intermediate folders.
    func folder(_ path: String) throws -> URL {
        let folder = url.appending(path: path, directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder
    }
}
