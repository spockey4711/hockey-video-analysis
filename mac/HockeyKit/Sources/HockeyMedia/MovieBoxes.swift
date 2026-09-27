import Foundation

/// The few ISO BMFF (MP4) boxes a clip file's check needs: the top-level boxes
/// and the movie box (`moov`) with the tracks inside it. AVAssetWriter adds an
/// edit list (`edts`) to a track whose first sample does not play at time
/// zero; browsers apply such lists differently, so a clip goes out without
/// any (ADR 0013). Removing one leaves every sample where it is.

enum MovieBoxError: Error {
    case malformed
}

/// A box: its four-character type and where it lies, header included.
struct MovieBox: Equatable {
    let type: String
    let offset: Int
    let size: Int
    let headerSize: Int

    var end: Int { offset + size }
    var bodyOffset: Int { offset + headerSize }
}

/// The boxes that hold the boxes this file cares about.
private let containerTypes: Set = ["moov", "trak", "mdia", "minf", "stbl", "edts"]

/// The boxes inside `data[range]`, in order.
func movieBoxes(in data: Data, range: Range<Int>) throws -> [MovieBox] {
    var boxes: [MovieBox] = []
    var offset = range.lowerBound
    while offset < range.upperBound {
        guard let box = try readBoxHeader(at: offset, limit: range.upperBound, read: { data.subdata(in: $0) }) else { break }
        boxes.append(box)
        offset = box.end
    }
    return boxes
}

/// The header at `offset`, or `nil` when fewer than 8 bytes are left.
private func readBoxHeader(at offset: Int, limit: Int, read: (Range<Int>) throws -> Data) throws -> MovieBox? {
    guard limit - offset >= 8 else { return nil }
    let header = try read(offset..<min(offset + 16, limit))
    var size = Int(header.bigEndian(UInt32.self, at: 0))
    let type = String(decoding: header[header.startIndex + 4..<header.startIndex + 8], as: UTF8.self)
    var headerSize = 8
    if size == 1 {
        guard header.count >= 16 else { throw MovieBoxError.malformed }
        size = Int(header.bigEndian(UInt64.self, at: 8))
        headerSize = 16
    } else if size == 0 {
        size = limit - offset
    }
    guard size >= headerSize, offset + size <= limit else { throw MovieBoxError.malformed }
    return MovieBox(type: type, offset: offset, size: size, headerSize: headerSize)
}

/// The file's top-level boxes.
func topLevelBoxes(of url: URL) throws -> [MovieBox] {
    let handle = try FileHandle(forReadingFrom: url)
    defer { try? handle.close() }
    let length = Int(try handle.seekToEnd())
    var boxes: [MovieBox] = []
    var offset = 0
    while let box = try readBoxHeader(at: offset, limit: length, read: { range in
        try handle.seek(toOffset: UInt64(range.lowerBound))
        return try handle.read(upToCount: range.count) ?? Data()
    }) {
        boxes.append(box)
        offset = box.end
    }
    return boxes
}

/// The movie box's bytes and where it lies.
func readMovieBox(of url: URL) throws -> (box: MovieBox, data: Data) {
    guard let moov = try topLevelBoxes(of: url).first(where: { $0.type == "moov" }) else { throw MovieBoxError.malformed }
    let handle = try FileHandle(forReadingFrom: url)
    defer { try? handle.close() }
    try handle.seek(toOffset: UInt64(moov.offset))
    guard let data = try handle.read(upToCount: moov.size), data.count == moov.size else { throw MovieBoxError.malformed }
    return (moov, data)
}

/// The type paths of every box in the movie box, such as `moov/trak/edts`.
func movieBoxPaths(of url: URL) throws -> [String] {
    let (_, data) = try readMovieBox(of: url)
    func walk(_ range: Range<Int>, _ prefix: String) throws -> [String] {
        try movieBoxes(in: data, range: range).flatMap { box -> [String] in
            let path = prefix.isEmpty ? box.type : "\(prefix)/\(box.type)"
            let inner = containerTypes.contains(box.type) ? try walk(box.bodyOffset..<box.end, path) : []
            return [path] + inner
        }
    }
    return try walk(0..<data.count, "")
}

/// Removes every track's edit list from the MP4 at `url`, in place. A movie
/// box before the media data shrinks, so the chunk offsets that point past it
/// move back by as much.
func stripEditLists(at url: URL) throws {
    let (moov, data) = try readMovieBox(of: url)
    guard try movieBoxPaths(of: url).contains("moov/trak/edts") else { return }

    // The tables first, to learn how much shorter the box gets.
    var rebuilt = try rebuild(data, 0..<data.count, parent: "", shift: 0)
    let removed = data.count - rebuilt.count
    let mediaAfter = try topLevelBoxes(of: url).contains { $0.type == "mdat" && $0.offset > moov.offset }
    if mediaAfter { rebuilt = try rebuild(data, 0..<data.count, parent: "", shift: removed) }

    let temporary = url.deletingLastPathComponent().appending(path: ".\(url.lastPathComponent).edts")
    defer { try? FileManager.default.removeItem(at: temporary) }
    FileManager.default.createFile(atPath: temporary.path(percentEncoded: false), contents: nil)
    let source = try FileHandle(forReadingFrom: url)
    defer { try? source.close() }
    let target = try FileHandle(forWritingTo: temporary)
    defer { try? target.close() }
    try copy(from: source, range: 0..<moov.offset, to: target)
    try target.write(contentsOf: rebuilt)
    let length = Int(try source.seekToEnd())
    try copy(from: source, range: moov.end..<length, to: target)
    try target.close()
    _ = try FileManager.default.replaceItemAt(url, withItemAt: temporary)
}

private func copy(from source: FileHandle, range: Range<Int>, to target: FileHandle) throws {
    try source.seek(toOffset: UInt64(range.lowerBound))
    var left = range.count
    while left > 0 {
        guard let chunk = try source.read(upToCount: min(left, 8 << 20)), !chunk.isEmpty else { throw MovieBoxError.malformed }
        try target.write(contentsOf: chunk)
        left -= chunk.count
    }
}

/// `data[range]`'s boxes again, without a track's `edts` and with every chunk
/// offset moved back by `shift`.
private func rebuild(_ data: Data, _ range: Range<Int>, parent: String, shift: Int) throws -> Data {
    var out = Data()
    for box in try movieBoxes(in: data, range: range) {
        switch box.type {
        case "edts" where parent == "trak":
            continue
        case "moov", "trak", "mdia", "minf", "stbl":
            let body = try rebuild(data, box.bodyOffset..<box.end, parent: box.type, shift: shift)
            out.append(boxHeader(box.type, bodySize: body.count))
            out.append(body)
        case "stco", "co64":
            out.append(try shiftedChunkOffsets(data.subdata(in: box.offset..<box.end), box, shift: shift))
        default:
            out.append(data.subdata(in: box.offset..<box.end))
        }
    }
    return out
}

private func boxHeader(_ type: String, bodySize: Int) -> Data {
    var header = Data()
    header.appendBigEndian(UInt32(8 + bodySize))
    header.append(contentsOf: Array(type.utf8))
    return header
}

/// A chunk offset table (`stco`, or `co64` for large files) with each offset
/// moved back by `shift`.
private func shiftedChunkOffsets(_ bytes: Data, _ box: MovieBox, shift: Int) throws -> Data {
    guard shift != 0 else { return bytes }
    var table = bytes
    let wide = box.type == "co64"
    let countAt = box.headerSize + 4
    guard table.count >= countAt + 4 else { throw MovieBoxError.malformed }
    let count = Int(table.bigEndian(UInt32.self, at: countAt))
    let width = wide ? 8 : 4
    guard table.count >= countAt + 4 + count * width else { throw MovieBoxError.malformed }
    for entry in 0..<count {
        let at = countAt + 4 + entry * width
        if wide {
            let value = table.bigEndian(UInt64.self, at: at)
            table.replaceBigEndian(value - UInt64(shift), at: at)
        } else {
            let value = table.bigEndian(UInt32.self, at: at)
            table.replaceBigEndian(value - UInt32(shift), at: at)
        }
    }
    return table
}

extension Data {
    /// The big-endian integer at `offset` from the start.
    func bigEndian<Value: FixedWidthInteger>(_: Value.Type, at offset: Int) -> Value {
        var value: Value = 0
        for byte in self[(startIndex + offset)..<(startIndex + offset + MemoryLayout<Value>.size)] {
            value = value << 8 | Value(byte)
        }
        return value
    }

    mutating func replaceBigEndian<Value: FixedWidthInteger>(_ value: Value, at offset: Int) {
        let size = MemoryLayout<Value>.size
        for index in 0..<size {
            self[startIndex + offset + index] = UInt8(truncatingIfNeeded: value >> ((size - 1 - index) * 8))
        }
    }

    mutating func appendBigEndian<Value: FixedWidthInteger>(_ value: Value) {
        append(contentsOf: (0..<MemoryLayout<Value>.size).reversed().map { UInt8(truncatingIfNeeded: value >> ($0 * 8)) })
    }
}
