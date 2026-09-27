CREATE TYPE "public"."execution_outcome" AS ENUM('success', 'failure', 'open');--> statement-breakpoint
CREATE TABLE "scene_executions" (
	"scene_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"outcome" "execution_outcome" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scene_executions_scene_id_tag_id_pk" PRIMARY KEY("scene_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "scene_executions" ADD CONSTRAINT "scene_executions_scene_id_tactics_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."tactics_scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_executions" ADD CONSTRAINT "scene_executions_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scene_executions_tag_idx" ON "scene_executions" USING btree ("tag_id");