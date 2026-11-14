CREATE TABLE "catalog_refresh" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"outcome" text NOT NULL,
	"version_id" uuid,
	"error_code" text,
	"message" text,
	"duration_ms" integer,
	CONSTRAINT "catalog_refresh_outcome" CHECK ("catalog_refresh"."outcome" in ('success','failure'))
);
--> statement-breakpoint
CREATE TABLE "catalog_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"content_hash" text NOT NULL,
	"book_count" integer NOT NULL,
	"viewer_count" integer NOT NULL,
	"reconciliation" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "book" ADD COLUMN "viewer_url" text;--> statement-breakpoint
ALTER TABLE "catalog_refresh" ADD CONSTRAINT "catalog_refresh_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_refresh" ADD CONSTRAINT "catalog_refresh_version_id_catalog_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."catalog_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_version" ADD CONSTRAINT "catalog_version_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE no action ON UPDATE no action;