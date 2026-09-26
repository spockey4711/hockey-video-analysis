ALTER TABLE "collection_clips" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "quarters_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "tactics_scenes" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "tactics_scenes" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "team_settings" ADD COLUMN "roster_revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
-- Sync versions and revisions (ADR 0013, Mac plan S3). Triggers keep them, so
-- no write path can miss one. A row's version grows when one of its own fields
-- changes; an aggregate's revision grows on any change to any of its rows.
--
-- The sync counters and updated_at are bookkeeping, not fields: an update that
-- only moves them leaves the version alone, so a revision bump from a child row
-- never looks like an edit. Setting the version explicitly asks for a bump
-- (a tag's players changed).
CREATE FUNCTION "sync_bump_version"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF NEW."version" IS DISTINCT FROM OLD."version"
		OR (to_jsonb(NEW) - ARRAY['version', 'revision', 'quarters_version', 'updated_at'])
			IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['version', 'revision', 'quarters_version', 'updated_at'])
	THEN
		NEW."version" := OLD."version" + 1;
	END IF;
	RETURN NEW;
END $$;--> statement-breakpoint
-- Any update of an aggregate's root row is a change of the aggregate.
CREATE FUNCTION "sync_bump_revision"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	NEW."revision" := OLD."revision" + 1;
	RETURN NEW;
END $$;--> statement-breakpoint
-- Bump a counter on the parent row(s) of a changed child row. Arguments: the
-- parent table, the child's key column pointing at it, the counter to bump. A
-- parent deleted in the same statement (a cascade) is simply not found.
CREATE FUNCTION "sync_bump_parent"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
	old_id uuid;
	new_id uuid;
BEGIN
	IF TG_OP <> 'INSERT' THEN
		old_id := (to_jsonb(OLD) ->> TG_ARGV[1])::uuid;
	END IF;
	IF TG_OP <> 'DELETE' THEN
		new_id := (to_jsonb(NEW) ->> TG_ARGV[1])::uuid;
	END IF;
	EXECUTE format(
		'UPDATE %I SET %I = %I + 1 WHERE id IN ($1, $2)',
		TG_ARGV[0], TG_ARGV[2], TG_ARGV[2]
	) USING old_id, new_id;
	RETURN NULL;
END $$;--> statement-breakpoint
-- A clip belongs to its game through its tag, without changing the tag.
CREATE FUNCTION "sync_bump_clip_game"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	UPDATE "games" SET "revision" = "revision" + 1
	WHERE "id" IN (
		SELECT "game_id" FROM "tags"
		WHERE "id" IN (
			CASE WHEN TG_OP <> 'INSERT' THEN OLD."tag_id" END,
			CASE WHEN TG_OP <> 'DELETE' THEN NEW."tag_id" END
		)
	);
	RETURN NULL;
END $$;--> statement-breakpoint
-- The roster is one aggregate: every player row counts.
CREATE FUNCTION "sync_bump_roster"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	UPDATE "team_settings" SET "roster_revision" = "roster_revision" + 1;
	RETURN NULL;
END $$;--> statement-breakpoint
CREATE TRIGGER "games_sync_version" BEFORE UPDATE ON "games"
	FOR EACH ROW EXECUTE FUNCTION "sync_bump_version"();--> statement-breakpoint
CREATE TRIGGER "games_sync_revision" BEFORE UPDATE ON "games"
	FOR EACH ROW EXECUTE FUNCTION "sync_bump_revision"();--> statement-breakpoint
CREATE TRIGGER "game_sources_sync_game" AFTER INSERT OR UPDATE OR DELETE ON "game_sources"
	FOR EACH ROW EXECUTE FUNCTION "sync_bump_parent"('games', 'game_id', 'revision');--> statement-breakpoint
CREATE TRIGGER "quarters_sync_game" AFTER INSERT OR UPDATE OR DELETE ON "quarters"
	FOR EACH ROW EXECUTE FUNCTION "sync_bump_parent"('games', 'game_id', 'quarters_version');--> statement-breakpoint
CREATE TRIGGER "tags_sync_version" BEFORE UPDATE ON "tags"
	FOR EACH ROW EXECUTE FUNCTION "sync_bump_version"();--> statement-breakpoint
CREATE TRIGGER "tags_sync_game" AFTER INSERT OR UPDATE OR DELETE ON "tags"
	FOR EACH ROW EXECUTE FUNCTION "sync_bump_parent"('games', 'game_id', 'revision');--> statement-breakpoint
CREATE TRIGGER "tag_players_sync_tag" AFTER INSERT OR UPDATE OR DELETE ON "tag_players"
	FOR EACH ROW EXECUTE FUNCTION "sync_bump_parent"('tags', 'tag_id', 'version');--> statement-breakpoint
CREATE TRIGGER "clips_sync_game" AFTER INSERT OR UPDATE OR DELETE ON "clips"
	FOR EACH ROW EXECUTE FUNCTION "sync_bump_clip_game"();--> statement-breakpoint
CREATE TRIGGER "players_sync_version" BEFORE UPDATE ON "players"
	FOR EACH ROW EXECUTE FUNCTION "sync_bump_version"();--> statement-breakpoint
CREATE TRIGGER "players_sync_roster" AFTER INSERT OR UPDATE OR DELETE ON "players"
	FOR EACH ROW EXECUTE FUNCTION "sync_bump_roster"();--> statement-breakpoint
CREATE TRIGGER "collections_sync_version" BEFORE UPDATE ON "collections"
	FOR EACH ROW EXECUTE FUNCTION "sync_bump_version"();--> statement-breakpoint
CREATE TRIGGER "collections_sync_revision" BEFORE UPDATE ON "collections"
	FOR EACH ROW EXECUTE FUNCTION "sync_bump_revision"();--> statement-breakpoint
CREATE TRIGGER "collection_clips_sync_version" BEFORE UPDATE ON "collection_clips"
	FOR EACH ROW EXECUTE FUNCTION "sync_bump_version"();--> statement-breakpoint
CREATE TRIGGER "collection_clips_sync_collection" AFTER INSERT OR UPDATE OR DELETE ON "collection_clips"
	FOR EACH ROW EXECUTE FUNCTION "sync_bump_parent"('collections', 'collection_id', 'revision');--> statement-breakpoint
CREATE TRIGGER "collection_scenes_sync_collection" AFTER INSERT OR UPDATE OR DELETE ON "collection_scenes"
	FOR EACH ROW EXECUTE FUNCTION "sync_bump_parent"('collections', 'collection_id', 'revision');--> statement-breakpoint
CREATE TRIGGER "tactics_scenes_sync_version" BEFORE UPDATE ON "tactics_scenes"
	FOR EACH ROW EXECUTE FUNCTION "sync_bump_version"();--> statement-breakpoint
CREATE TRIGGER "tactics_scenes_sync_revision" BEFORE UPDATE ON "tactics_scenes"
	FOR EACH ROW EXECUTE FUNCTION "sync_bump_revision"();
