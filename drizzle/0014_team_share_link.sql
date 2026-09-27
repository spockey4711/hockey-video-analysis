ALTER TABLE "collections" ADD COLUMN "share_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "team_settings" ADD COLUMN "team_share_token" text;