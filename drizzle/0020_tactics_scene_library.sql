CREATE TYPE "public"."scene_category" AS ENUM('attack_corner', 'defence_corner', 'free_hit', 'press', 'build_up', 'other');--> statement-breakpoint
ALTER TABLE "tactics_scenes" ADD COLUMN "category" "scene_category" DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "tactics_scenes" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;