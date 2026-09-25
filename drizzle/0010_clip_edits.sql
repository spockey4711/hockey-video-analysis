ALTER TABLE "clips" ADD COLUMN "cut_start_s" double precision;--> statement-breakpoint
ALTER TABLE "collection_clips" ADD COLUMN "edit" jsonb;--> statement-breakpoint
ALTER TABLE "collection_clips" ADD COLUMN "edit_version" integer DEFAULT 0 NOT NULL;