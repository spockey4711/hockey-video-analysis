/**
 * Database schema for the hockey-video-analysis app.
 *
 * This is the single source of truth for every table in the system. The MVP
 * waves (P0-1) created the full schema here and no MVP task edits `drizzle/`;
 * they only add queries. Post-MVP features may append tables (P2-13 added the
 * `collections`/`collection_clips` pair, P2-17 `ingest_folders`, the collection
 * insights `collection_view_events`, the tactics board `tactics_scenes`), each
 * shipping its own migration.
 *
 * Time model (ADR 0002): every persisted timestamp that refers to a moment in a
 * game is a global game-time offset in seconds (`*_s` columns), independent of
 * which chapter file it falls in. The (source file, local offset) mapping is
 * computed at the edges from `game_sources.duration_s`, never stored.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// --- Enums (stable domain values; configurable tag *types* stay free text) ---

/** Who a tag or its cut clip is shared with. `single` is player-specific. */
export const visibilityEnum = pgEnum("visibility", ["team", "single"]);

/** How a tag came to exist: captured by a coach, or confirmed from a whistle candidate. */
export const tagSourceEnum = pgEnum("tag_source", ["manual", "suggestion"]);

/** Lifecycle of a clip cut job handed to the clip cut worker (ADR 0007). */
export const clipStatusEnum = pgEnum("clip_status", [
  "pending",
  "processing",
  "ready",
  "failed",
]);

/**
 * What the Drive importer (P2-17) decided about a game folder: `skipped` (it was
 * already on Drive before the importer's first run), `imported` (it became a
 * game) or `rejected` (its files do not form a game; the reason is stored).
 */
export const ingestFolderStatusEnum = pgEnum("ingest_folder_status", [
  "skipped",
  "imported",
  "rejected",
]);

/**
 * What a viewer did with a clip on a collection share link (ADR 0009): `click`
 * (started it), `full_view` (played it to its end, or at least 90 % of it) or
 * `replay` (started it again after that).
 */
export const viewEventTypeEnum = pgEnum("view_event_type", [
  "click",
  "full_view",
  "replay",
]);

/** Review state of a double-whistle candidate; never auto-committed. */
export const whistleStatusEnum = pgEnum("whistle_status", [
  "pending",
  "confirmed",
  "rejected",
]);

// --- Shared column helpers ---------------------------------------------------

const createdAt = timestamp("created_at", { withTimezone: true })
  .defaultNow()
  .notNull();

const updatedAt = timestamp("updated_at", { withTimezone: true })
  .defaultNow()
  .notNull()
  .$onUpdate(() => new Date());

// --- Auth (wires the `auth` flavor; consumed by P0-2 coach login) -----------

/** A coach account. Coaches authenticate to create and edit content. */
export const coaches = pgTable("coaches", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  // Memory-hard hash (argon2id/bcrypt); never a plaintext password.
  passwordHash: text("password_hash").notNull(),
  createdAt,
  updatedAt,
});

/** A server-side login session, keyed by the (hashed) session token id. */
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  coachId: uuid("coach_id")
    .notNull()
    .references(() => coaches.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt,
});

// --- Games and their ordered chapter files ----------------------------------

/** One field-hockey game. Its recording is 1..N ordered chapter files. */
export const games = pgTable("games", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  opponent: text("opponent"),
  playedOn: date("played_on"),
  // The coach who created the game; kept if that coach is later deleted.
  createdBy: uuid("created_by").references(() => coaches.id, {
    onDelete: "set null",
  }),
  // A game the Drive importer registered is hidden from the coach until every
  // chapter has its tagging proxy (P2-17); the ingest worker clears it.
  awaitingProxies: boolean("awaiting_proxies").notNull().default(false),
  createdAt,
  updatedAt,
});

/**
 * A single chapter file of a game's recording (the GoPro splits at ~4 GB).
 * `orderIndex` fixes the chapter order and must stay stable once tagging has
 * begun (ADR 0002); `durationS` feeds the global-time mapping.
 */
export const gameSources = pgTable(
  "game_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    // Path to the file on the NAS; the file is referenced, never re-uploaded.
    filePath: text("file_path").notNull(),
    // Chapter duration in seconds (may be fractional).
    durationS: doublePrecision("duration_s").notNull(),
    createdAt,
  },
  (table) => [
    unique("game_sources_game_order_unq").on(table.gameId, table.orderIndex),
  ],
);

// --- Players and share links -------------------------------------------------

/**
 * A team player. `shareToken` is the unguessable secret that grants login-free
 * read access to this player's clip view; it is a secret and can be rotated.
 */
export const players = pgTable("players", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  jerseyNumber: integer("jersey_number"),
  shareToken: text("share_token").notNull().unique(),
  createdAt,
  updatedAt,
});

// --- Tags and their player links --------------------------------------------

/**
 * A tagged moment in a game. `startS`/`endS` are global game-time offsets in
 * seconds; `endS` is optional (a per-type default window applies otherwise).
 * `type` is a free-text key resolved against the configurable tag-type module
 * (P1-3), so new types need no migration.
 */
export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  startS: doublePrecision("start_s").notNull(),
  endS: doublePrecision("end_s"),
  visibility: visibilityEnum("visibility").notNull().default("team"),
  // The coach who captured the tag, so parallel coaches are distinguishable.
  authorId: uuid("author_id").references(() => coaches.id, {
    onDelete: "set null",
  }),
  source: tagSourceEnum("source").notNull().default("manual"),
  createdAt,
  updatedAt,
});

/** n:m link between a tag and the players it involves. */
export const tagPlayers = pgTable(
  "tag_players",
  {
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.tagId, table.playerId] })],
);

// --- Clips (cut jobs) and their comments ------------------------------------

/**
 * A clip cut from a tag by the clip cut worker (ADR 0007). `outputPath` is
 * filled once the worker reports the cut file as `ready`.
 */
export const clips = pgTable("clips", {
  id: uuid("id").defaultRandom().primaryKey(),
  tagId: uuid("tag_id")
    .notNull()
    .references(() => tags.id, { onDelete: "cascade" }),
  status: clipStatusEnum("status").notNull().default("pending"),
  outputPath: text("output_path"),
  createdAt,
  updatedAt,
});

/**
 * A comment on a clip. Mostly authored on a login-free share link, so `author`
 * is a free-text name rather than a coach reference. `isCoach` marks a comment
 * posted through a signed-in coach session; the server sets it from the session,
 * never from the request body, so a share-link viewer can never create one.
 */
export const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  clipId: uuid("clip_id")
    .notNull()
    .references(() => clips.id, { onDelete: "cascade" }),
  author: text("author").notNull(),
  body: text("body").notNull(),
  isCoach: boolean("is_coach").notNull().default(false),
  createdAt,
});

// --- Quarters ----------------------------------------------------------------

/**
 * A manually set quarter boundary within a game. `startS`/`endS` are global
 * game-time offsets in seconds; `index` is the quarter number (1..4).
 */
export const quarters = pgTable(
  "quarters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    index: integer("index").notNull(),
    startS: doublePrecision("start_s").notNull(),
    endS: doublePrecision("end_s"),
  },
  (table) => [unique("quarters_game_index_unq").on(table.gameId, table.index)],
);

// --- Whistle candidates (goal suggestions from the pipeline) -----------------

/**
 * A double-whistle candidate timestamp reported by hockey-video-pipeline.
 * `atS` is a global game-time offset in seconds. Candidates are reviewed by a
 * coach (confirm/reject) and never auto-committed to tags.
 */
export const whistleCandidates = pgTable("whistle_candidates", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  atS: doublePrecision("at_s").notNull(),
  status: whistleStatusEnum("status").notNull().default("pending"),
  createdAt,
});

// --- Clip collections (curated share playlists) ------------------------------

/**
 * A coach-curated, named set of ready clips ("Standards Woche 3"), shared
 * login-free by its own `shareToken` - the same unguessable-secret model the
 * per-player link uses (see {@link players}), but for an arbitrary hand-picked
 * playlist rather than one player's clips. Rotating the token revokes the link.
 * A post-MVP addition (P2-13); the MVP schema froze without it.
 */
export const collections = pgTable("collections", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  shareToken: text("share_token").notNull().unique(),
  // The coach who created the collection; kept if that coach is later deleted.
  createdBy: uuid("created_by").references(() => coaches.id, {
    onDelete: "set null",
  }),
  // The coach's private presenter note for the whole collection, shown in
  // presentation mode to a signed-in coach only and never on the link itself.
  presenterNote: text("presenter_note"),
  // The coach's intro for the team, public to anyone with the share link: shown
  // on the link and as a title card before the first clip in presentation mode.
  teamNote: text("team_note"),
  createdAt,
  updatedAt,
});

/**
 * n:m link between a collection and the ready clips it contains. Membership is a
 * plain set; the share playlist orders it chronologically (like the team and
 * per-player links), so no explicit ordering column is stored. Deleting either
 * side removes the membership row, and with it the clip's presenter note.
 */
export const collectionClips = pgTable(
  "collection_clips",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    clipId: uuid("clip_id")
      .notNull()
      .references(() => clips.id, { onDelete: "cascade" }),
    // The coach's private presenter note for this clip in this collection; see
    // `collections.presenter_note`.
    presenterNote: text("presenter_note"),
    // The coach's short text for the team on this clip, public to anyone with
    // the link: shown under the clip and as a title card before it plays; see
    // `collections.team_note`.
    teamNote: text("team_note"),
    createdAt,
  },
  (table) => [primaryKey({ columns: [table.collectionId, table.clipId] })],
);

/**
 * One anonymous viewing event on a collection share link (ADR 0009). No viewer
 * is identified: `viewerKey` is a hash of the request's IP address, user agent
 * and collection id under a salt that lives only in memory for one UTC `day`, so
 * it counts unique viewers within that day and cannot be traced back once the
 * day is over. Deleting the collection or the clip removes its events; rows are
 * pruned after the retention period.
 */
export const collectionViewEvents = pgTable(
  "collection_view_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    clipId: uuid("clip_id")
      .notNull()
      .references(() => clips.id, { onDelete: "cascade" }),
    type: viewEventTypeEnum("type").notNull(),
    day: date("day").notNull(),
    viewerKey: text("viewer_key").notNull(),
    createdAt,
  },
  (table) => [
    index("collection_view_events_collection_day_idx").on(
      table.collectionId,
      table.day,
    ),
    index("collection_view_events_viewer_idx").on(
      table.collectionId,
      table.viewerKey,
      table.day,
    ),
  ],
);

/**
 * One game folder under the Drive root that the importer has settled on (P2-17,
 * ADR 0008). The importer never moves or marks anything on Drive, so this table
 * is the only record of which folders are done: a folder without a row is new.
 * `folderPath` is the folder's name relative to the source root, the same prefix
 * its chapters carry in `game_sources.file_path`. A post-MVP addition; the MVP
 * schema froze without it.
 */
export const ingestFolders = pgTable("ingest_folders", {
  id: uuid("id").defaultRandom().primaryKey(),
  folderPath: text("folder_path").notNull().unique(),
  status: ingestFolderStatusEnum("status").notNull(),
  // The game an `imported` folder became; kept as null if the game is deleted,
  // so the folder is not imported a second time.
  gameId: uuid("game_id").references(() => games.id, { onDelete: "set null" }),
  // Why a folder was `skipped` or `rejected`, or how an `imported` folder has
  // changed on Drive in a way its game did not follow; for the operator and
  // the coach.
  detail: text("detail"),
  // The folder's game parts when the importer settled on it, one
  // `<file name>\t<size in bytes>` line each: a folder renamed or copied on
  // Drive is recognised by them and not imported a second time.
  parts: text("parts"),
  createdAt,
  updatedAt,
});

/**
 * One tactics board scene (ADR 0010): players, ball and lines on the pitch,
 * kept as one versioned JSON document in pitch metres. The document's shape is
 * owned by `src/features/tactics/scene.ts`, which validates every scene before
 * it is stored; the database only holds it. Coach-only, never shared by link.
 */
export const tacticsScenes = pgTable("tactics_scenes", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  scene: jsonb("scene").notNull(),
  // The coach who created the scene; kept if that coach is later deleted.
  createdBy: uuid("created_by").references(() => coaches.id, {
    onDelete: "set null",
  }),
  createdAt,
  updatedAt,
});

// --- Relations (for the drizzle relational query API) -----------------------

export const coachesRelations = relations(coaches, ({ many }) => ({
  sessions: many(sessions),
  games: many(games),
  tags: many(tags),
  collections: many(collections),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  coach: one(coaches, { fields: [sessions.coachId], references: [coaches.id] }),
}));

export const gamesRelations = relations(games, ({ one, many }) => ({
  createdByCoach: one(coaches, {
    fields: [games.createdBy],
    references: [coaches.id],
  }),
  sources: many(gameSources),
  tags: many(tags),
  quarters: many(quarters),
  whistleCandidates: many(whistleCandidates),
}));

export const gameSourcesRelations = relations(gameSources, ({ one }) => ({
  game: one(games, { fields: [gameSources.gameId], references: [games.id] }),
}));

export const playersRelations = relations(players, ({ many }) => ({
  tagPlayers: many(tagPlayers),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  game: one(games, { fields: [tags.gameId], references: [games.id] }),
  author: one(coaches, { fields: [tags.authorId], references: [coaches.id] }),
  tagPlayers: many(tagPlayers),
  clips: many(clips),
}));

export const tagPlayersRelations = relations(tagPlayers, ({ one }) => ({
  tag: one(tags, { fields: [tagPlayers.tagId], references: [tags.id] }),
  player: one(players, {
    fields: [tagPlayers.playerId],
    references: [players.id],
  }),
}));

export const clipsRelations = relations(clips, ({ one, many }) => ({
  tag: one(tags, { fields: [clips.tagId], references: [tags.id] }),
  comments: many(comments),
  collectionClips: many(collectionClips),
}));

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  createdByCoach: one(coaches, {
    fields: [collections.createdBy],
    references: [coaches.id],
  }),
  collectionClips: many(collectionClips),
}));

export const collectionClipsRelations = relations(
  collectionClips,
  ({ one }) => ({
    collection: one(collections, {
      fields: [collectionClips.collectionId],
      references: [collections.id],
    }),
    clip: one(clips, {
      fields: [collectionClips.clipId],
      references: [clips.id],
    }),
  }),
);

export const commentsRelations = relations(comments, ({ one }) => ({
  clip: one(clips, { fields: [comments.clipId], references: [clips.id] }),
}));

export const quartersRelations = relations(quarters, ({ one }) => ({
  game: one(games, { fields: [quarters.gameId], references: [games.id] }),
}));

export const whistleCandidatesRelations = relations(
  whistleCandidates,
  ({ one }) => ({
    game: one(games, {
      fields: [whistleCandidates.gameId],
      references: [games.id],
    }),
  }),
);
