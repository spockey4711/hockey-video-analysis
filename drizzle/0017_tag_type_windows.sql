CREATE TABLE "tag_type_windows" (
	"type" text PRIMARY KEY NOT NULL,
	"pre_s" integer NOT NULL,
	"post_s" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tag_type_windows_pre_s" CHECK ("tag_type_windows"."pre_s" between 0 and 60),
	CONSTRAINT "tag_type_windows_post_s" CHECK ("tag_type_windows"."post_s" between 1 and 60)
);
