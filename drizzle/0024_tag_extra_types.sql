-- A tag's further types next to its main type (ADR 0016). A constant default
-- is a catalogue change: no row is rewritten and no sync trigger fires, so no
-- tag version or game revision moves. Every existing tag has none.
ALTER TABLE "tags" ADD COLUMN "extra_types" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_extra_types" CHECK ("tags"."type" <> all("tags"."extra_types") and array_position("tags"."extra_types", null) is null);
