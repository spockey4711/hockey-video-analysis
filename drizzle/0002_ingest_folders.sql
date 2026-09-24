CREATE TYPE "public"."ingest_folder_status" AS ENUM('skipped', 'imported', 'rejected');--> statement-breakpoint
CREATE TABLE "ingest_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folder_path" text NOT NULL,
	"status" "ingest_folder_status" NOT NULL,
	"game_id" uuid,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingest_folders_folder_path_unique" UNIQUE("folder_path")
);
--> statement-breakpoint
ALTER TABLE "ingest_folders" ADD CONSTRAINT "ingest_folders_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;