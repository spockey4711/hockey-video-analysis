CREATE TYPE "public"."view_event_type" AS ENUM('click', 'full_view', 'replay');--> statement-breakpoint
CREATE TABLE "collection_view_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"clip_id" uuid NOT NULL,
	"type" "view_event_type" NOT NULL,
	"day" date NOT NULL,
	"viewer_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_view_events" ADD CONSTRAINT "collection_view_events_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_view_events" ADD CONSTRAINT "collection_view_events_clip_id_clips_id_fk" FOREIGN KEY ("clip_id") REFERENCES "public"."clips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_view_events_collection_day_idx" ON "collection_view_events" USING btree ("collection_id","day");--> statement-breakpoint
CREATE INDEX "collection_view_events_viewer_idx" ON "collection_view_events" USING btree ("collection_id","viewer_key","day");