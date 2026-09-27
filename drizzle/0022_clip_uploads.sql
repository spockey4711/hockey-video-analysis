CREATE TYPE "public"."upload_purpose" AS ENUM('clip');--> statement-breakpoint
CREATE TYPE "public"."upload_status" AS ENUM('receiving', 'submitted', 'done', 'failed');--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"purpose" "upload_purpose" NOT NULL,
	"clip_id" uuid,
	"size_bytes" bigint NOT NULL,
	"received_bytes" bigint DEFAULT 0 NOT NULL,
	"status" "upload_status" DEFAULT 'receiving' NOT NULL,
	"tag_version" integer,
	"cut_start_s" double precision,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uploads_size" CHECK ("uploads"."size_bytes" > 0),
	CONSTRAINT "uploads_received" CHECK ("uploads"."received_bytes" between 0 and "uploads"."size_bytes"),
	CONSTRAINT "uploads_clip_target" CHECK ("uploads"."purpose" <> 'clip' or "uploads"."clip_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_coach_id_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_clip_id_clips_id_fk" FOREIGN KEY ("clip_id") REFERENCES "public"."clips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "uploads_status_idx" ON "uploads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "uploads_clip_idx" ON "uploads" USING btree ("clip_id");