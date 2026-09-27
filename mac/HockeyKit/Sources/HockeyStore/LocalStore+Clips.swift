import Foundation
import GRDB
import HockeyCore

/// The store's side of cutting clips on this Mac (ADR 0013): the clips the
/// server asked for, as the pulls bring them, and the Mac's work on each one.
/// The rules of what to cut and send live in `HockeySync`.

/// A file this Mac cut for a clip, and the window it holds.
public struct ClipCut: Equatable, Sendable {
    /// The file's name in the app's clip folder.
    public let fileName: String
    /// The tag start and the clip end the file was cut for.
    public let tagStartS: Double
    public let endS: Double
    /// The game time at the file's time 0 (`clips.cut_start_s`).
    public let cutStartS: Double
    public let sizeBytes: Int64

    public init(fileName: String, tagStartS: Double, endS: Double, cutStartS: Double, sizeBytes: Int64) {
        self.fileName = fileName
        self.tagStartS = tagStartS
        self.endS = endS
        self.cutStartS = cutStartS
        self.sizeBytes = sizeBytes
    }
}

/// A clip this Mac is to cut and send: a `pending` clip of one of its games
/// whose tag the server has as this Mac has it.
public struct ClipJob: Equatable, Sendable, Identifiable {
    public let id: UUID
    public let gameID: UUID
    public let tagID: UUID
    public let tag: TagFields
    /// The tag's version on the server, which the file is handed off with.
    public let tagVersion: Int
    public let chapters: [StoredChapter]
    /// Where the game's chapter files were last opened, if anywhere.
    public let folderBookmark: Data?
    public let cut: ClipCut?
    public let uploadID: UUID?
}

extension LocalStore {
    /// The clips waiting for this Mac, oldest tag first. A clip waits while
    /// its tag has changes the server does not have yet: the server must see
    /// the window the file holds.
    public func clipJobs() throws -> [ClipJob] {
        try database.read { db in
            let rows = try Row.fetchAll(db, sql: """
                SELECT clip.id FROM clip
                JOIN tag ON tag.id = clip.tag_id
                JOIN game ON game.id = tag.game_id
                WHERE clip.status = 'pending' AND game.media_home = 'mac' AND game.sync_off = 0
                  AND tag.version IS NOT NULL
                  AND (clip.held_below_version IS NULL OR tag.version >= clip.held_below_version)
                  AND NOT EXISTS (SELECT 1 FROM outbox WHERE outbox.target_id = tag.id)
                ORDER BY tag.created_at, tag.id
                """)
            return try rows.compactMap { row in
                let id: String = row["id"]
                guard let clip = try ClipRecord.fetchOne(db, key: id),
                      let tag = try TagRecord.fetchOne(db, key: clip.tagId.storedValue),
                      let version = tag.version,
                      let game = try GameRecord.fetchOne(db, key: tag.gameId.storedValue)
                else { return nil }
                return ClipJob(
                    id: clip.id,
                    gameID: game.id,
                    tagID: tag.id,
                    tag: tag.state.fields,
                    tagVersion: version,
                    chapters: try fetchGame(db, id: game.id.storedValue).chapters,
                    folderBookmark: game.folderBookmark,
                    cut: clip.cut,
                    uploadID: clip.uploadId
                )
            }
        }
    }

    /// The newest clip's status of each tag of a game that has one.
    public func clipStatuses(ofGame gameID: UUID) throws -> [UUID: ClipStatus] {
        try database.read { db in
            let rows = try Row.fetchAll(db, sql: """
                SELECT clip.tag_id, clip.status FROM clip JOIN tag ON tag.id = clip.tag_id WHERE tag.game_id = ?
                """, arguments: [gameID.storedValue])
            return Dictionary(rows.compactMap { row -> (UUID, ClipStatus)? in
                guard let tag = UUID(uuidString: row["tag_id"]), let status = ClipStatus(rawValue: row["status"]) else { return nil }
                return (tag, status)
            }) { first, _ in first }
        }
    }

    /// The names of the clip files the store still needs; any other file in
    /// the clip folder is left over.
    public func clipFileNames() throws -> Set<String> {
        try database.read { db in
            try Set(String.fetchAll(db, sql: "SELECT cut_file FROM clip WHERE cut_file IS NOT NULL"))
        }
    }

    /// Keeps the file this Mac cut for a clip; a new file needs a new upload.
    public func recordCut(_ cut: ClipCut, ofClip clipID: UUID) throws {
        try updateClip(clipID) {
            $0.cut = cut
            $0.uploadId = nil
        }
    }

    /// Forgets a clip's file and upload, to cut it again.
    public func dropCut(ofClip clipID: UUID) throws {
        try updateClip(clipID) {
            $0.cut = nil
            $0.uploadId = nil
        }
    }

    /// Keeps the upload that takes a clip's file to the server, or forgets it.
    public func recordUpload(_ uploadID: UUID?, ofClip clipID: UUID) throws {
        try updateClip(clipID) { $0.uploadId = uploadID }
    }

    /// The server took the file: the clip is `processing` until it has
    /// checked it, and the Mac needs the file no more.
    public func settleHandOff(ofClip clipID: UUID) throws {
        try updateClip(clipID) {
            $0.status = .processing
            $0.cut = nil
            $0.uploadId = nil
        }
    }

    /// Holds a clip until its tag reaches `version`.
    public func holdClip(_ clipID: UUID, untilTagVersion version: Int) throws {
        try updateClip(clipID) { $0.heldBelowVersion = version }
    }

    /// Where the game's chapter files are on this Mac, as a bookmark.
    public func setFolderBookmark(_ bookmark: Data, ofGame gameID: UUID) throws {
        try database.write { db in
            try db.execute(sql: "UPDATE game SET folder_bookmark = ? WHERE id = ?", arguments: [bookmark, gameID.storedValue])
        }
    }

    private func updateClip(_ clipID: UUID, _ change: (inout ClipRecord) -> Void) throws {
        try database.write { db in
            guard var record = try ClipRecord.fetchOne(db, key: clipID.storedValue) else { return }
            change(&record)
            try record.update(db)
        }
    }

    /// Brings in the newest clip of each of a game's tags as the server has
    /// it. Returns whether a status changed.
    func applyServerClips(_ db: Database, _ tags: [ServerTag]) throws -> Bool {
        var changed = false
        for tag in tags {
            let existing = try ClipRecord.filter(Column("tag_id") == tag.id.storedValue).fetchAll(db)
            for old in existing where old.id != tag.clip?.id {
                try old.delete(db)
                changed = true
            }
            guard let clip = tag.clip, try TagRecord.exists(db, key: tag.id.storedValue) else { continue }
            if var record = existing.first(where: { $0.id == clip.id }) {
                guard record.status != clip.status else { continue }
                record.status = clip.status
                try record.update(db)
            } else {
                try ClipRecord(id: clip.id, tagId: tag.id, status: clip.status).insert(db)
            }
            changed = true
        }
        return changed
    }
}

extension ClipRecord {
    /// The file cut for the clip, while there is one.
    var cut: ClipCut? {
        get {
            guard let cutFile, let cutTagStartS, let cutEndS, let cutStartS, let cutSizeBytes else { return nil }
            return ClipCut(fileName: cutFile, tagStartS: cutTagStartS, endS: cutEndS, cutStartS: cutStartS, sizeBytes: cutSizeBytes)
        }
        set {
            cutFile = newValue?.fileName
            cutTagStartS = newValue?.tagStartS
            cutEndS = newValue?.endS
            cutStartS = newValue?.cutStartS
            cutSizeBytes = newValue?.sizeBytes
        }
    }
}
