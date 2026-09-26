CREATE TYPE "public"."media_home" AS ENUM('drive', 'mac');--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "media_home" "media_home" DEFAULT 'drive' NOT NULL;