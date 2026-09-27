CREATE TYPE "public"."formation_kind" AS ENUM('attack', 'defence');--> statement-breakpoint
CREATE TABLE "tactics_formations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" "formation_kind" NOT NULL,
	"formation" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tactics_formations" ADD CONSTRAINT "tactics_formations_created_by_coaches_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."coaches"("id") ON DELETE set null ON UPDATE no action;