CREATE TABLE "team_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"period_count" integer DEFAULT 4 NOT NULL,
	"period_length_s" integer DEFAULT 900 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_settings_singleton" CHECK ("team_settings"."id" = 1),
	CONSTRAINT "team_settings_period_count" CHECK ("team_settings"."period_count" in (2, 4)),
	CONSTRAINT "team_settings_period_length" CHECK ("team_settings"."period_length_s" between 60 and 3600 and "team_settings"."period_length_s" % 60 = 0)
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "period_count" integer;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "period_length_s" integer;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_period_count" CHECK ("games"."period_count" in (2, 4));--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_period_length" CHECK ("games"."period_length_s" between 60 and 3600 and "games"."period_length_s" % 60 = 0);--> statement-breakpoint
-- The team default starts as 4 x 15 minutes, so every existing game keeps that format.
INSERT INTO "team_settings" ("id") VALUES (1);
