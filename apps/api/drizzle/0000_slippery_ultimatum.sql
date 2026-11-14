CREATE TYPE "public"."record_type" AS ENUM('baptism', 'marriage', 'death', 'undetermined');--> statement-breakpoint
CREATE TYPE "public"."validation_status" AS ENUM('draft', 'in_review', 'validated', 'rejected');--> statement-breakpoint
CREATE TABLE "archival_unit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text,
	"parent_id" uuid,
	"level" text NOT NULL,
	"reference_code" text,
	"title" text NOT NULL,
	"start_date" jsonb,
	"end_date" jsonb,
	CONSTRAINT "archival_unit_level" CHECK ("archival_unit"."level" in ('fonds','series','subseries'))
);
--> statement-breakpoint
CREATE TABLE "book" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text,
	"archival_unit_id" uuid NOT NULL,
	"reference_code" text,
	"shelfmark" text,
	"title" text NOT NULL,
	"start_date" jsonb,
	"end_date" jsonb,
	"folio_count" integer,
	"source_url" text,
	CONSTRAINT "book_folio_count" CHECK ("book"."folio_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "image_ref" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text,
	"book_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"folio" text,
	"side" text DEFAULT 'unknown' NOT NULL,
	"url" text,
	"storage_key" text,
	"rights_status" text DEFAULT 'unknown' NOT NULL,
	CONSTRAINT "image_sequence_unique" UNIQUE("book_id","sequence"),
	CONSTRAINT "image_sequence_nonnegative" CHECK ("image_ref"."sequence" >= 0),
	CONSTRAINT "image_side" CHECK ("image_ref"."side" in ('recto','verso','unknown'))
);
--> statement-breakpoint
CREATE TABLE "import_batch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "batch_external_unique" UNIQUE("source_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "participant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"revision_id" uuid NOT NULL,
	"role" text NOT NULL,
	"name_as_written" text NOT NULL,
	"normalized_name" text,
	"legibility" text DEFAULT 'legible' NOT NULL,
	"role_as_written" text,
	"notes" text,
	"position" integer NOT NULL,
	CONSTRAINT "participant_position_unique" UNIQUE("revision_id","position")
);
--> statement-breakpoint
CREATE TABLE "archive_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text,
	"book_id" uuid NOT NULL,
	"record_type" "record_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "record_revision_image" (
	"revision_id" uuid NOT NULL,
	"image_id" uuid NOT NULL,
	"region" jsonb,
	CONSTRAINT "revision_image_unique" UNIQUE("revision_id","image_id")
);
--> statement-breakpoint
CREATE TABLE "record_revision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"content_hash" text NOT NULL,
	"date" jsonb,
	"folio" text,
	"place_as_written" text,
	"normalized_place" text,
	"original_text" text,
	"marginal_notes" text,
	"status" "validation_status" DEFAULT 'draft' NOT NULL,
	"source_id" uuid NOT NULL,
	"method" text NOT NULL,
	"import_batch_id" uuid,
	"locator" text,
	"recorded_by" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"supersedes_revision_id" uuid,
	CONSTRAINT "revision_number_unique" UNIQUE("record_id","revision_number"),
	CONSTRAINT "revision_hash_unique" UNIQUE("record_id","content_hash"),
	CONSTRAINT "revision_method" CHECK ("record_revision"."method" in ('manual','import')),
	CONSTRAINT "revision_number_positive" CHECK ("record_revision"."revision_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"citation" text,
	"url" text,
	"rights_status" text DEFAULT 'unknown' NOT NULL,
	"accessed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "archival_unit" ADD CONSTRAINT "archival_unit_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book" ADD CONSTRAINT "book_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book" ADD CONSTRAINT "book_archival_unit_id_archival_unit_id_fk" FOREIGN KEY ("archival_unit_id") REFERENCES "public"."archival_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_ref" ADD CONSTRAINT "image_ref_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_ref" ADD CONSTRAINT "image_ref_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant" ADD CONSTRAINT "participant_revision_id_record_revision_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."record_revision"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archive_record" ADD CONSTRAINT "archive_record_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archive_record" ADD CONSTRAINT "archive_record_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_revision_image" ADD CONSTRAINT "record_revision_image_revision_id_record_revision_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."record_revision"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_revision_image" ADD CONSTRAINT "record_revision_image_image_id_image_ref_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."image_ref"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_revision" ADD CONSTRAINT "record_revision_record_id_archive_record_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."archive_record"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_revision" ADD CONSTRAINT "record_revision_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_revision" ADD CONSTRAINT "record_revision_import_batch_id_import_batch_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "archival_unit_external_unique" ON "archival_unit" USING btree ("source_id","external_id") WHERE "archival_unit"."external_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "book_external_unique" ON "book" USING btree ("source_id","external_id") WHERE "book"."external_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "image_external_unique" ON "image_ref" USING btree ("source_id","external_id") WHERE "image_ref"."external_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "record_external_unique" ON "archive_record" USING btree ("source_id","external_id") WHERE "archive_record"."external_id" is not null;