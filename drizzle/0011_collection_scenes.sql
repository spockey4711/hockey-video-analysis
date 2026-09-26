CREATE TABLE "collection_scenes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"scene_id" uuid NOT NULL,
	"after_clip_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"hold_s" double precision DEFAULT 8 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_scenes_collection_scene_unq" UNIQUE("collection_id","scene_id")
);
--> statement-breakpoint
ALTER TABLE "collection_scenes" ADD CONSTRAINT "collection_scenes_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_scenes" ADD CONSTRAINT "collection_scenes_scene_id_tactics_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."tactics_scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_scenes" ADD CONSTRAINT "collection_scenes_after_clip_id_clips_id_fk" FOREIGN KEY ("after_clip_id") REFERENCES "public"."clips"("id") ON DELETE set null ON UPDATE no action;