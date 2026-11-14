CREATE TABLE "extraction_proposal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"region" jsonb,
	"content" jsonb NOT NULL,
	"confidence" real NOT NULL,
	"confidence_kind" text DEFAULT 'estimate' NOT NULL,
	"has_illegible" boolean NOT NULL,
	"review_status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"revision_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "extraction_proposal_ordinal_unique" UNIQUE("run_id","ordinal"),
	CONSTRAINT "extraction_proposal_confidence" CHECK ("extraction_proposal"."confidence" between 0 and 1),
	CONSTRAINT "extraction_proposal_kind" CHECK ("extraction_proposal"."confidence_kind" in ('estimate')),
	CONSTRAINT "extraction_proposal_review" CHECK ("extraction_proposal"."review_status" in ('pending','accepted','rejected'))
);
--> statement-breakpoint
CREATE TABLE "extraction_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" text NOT NULL,
	"image_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"model" text NOT NULL,
	"model_version" text NOT NULL,
	"prompt_version" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer NOT NULL,
	"image_sha256" text,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "extraction_run_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "extraction_run_status" CHECK ("extraction_run"."status" in ('queued','running','succeeded','failed')),
	CONSTRAINT "extraction_run_attempts" CHECK ("extraction_run"."attempts" >= 0 and "extraction_run"."attempts" <= "extraction_run"."max_attempts")
);
--> statement-breakpoint
ALTER TABLE "extraction_proposal" ADD CONSTRAINT "extraction_proposal_run_id_extraction_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."extraction_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_proposal" ADD CONSTRAINT "extraction_proposal_revision_id_record_revision_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."record_revision"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_run" ADD CONSTRAINT "extraction_run_image_id_image_ref_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."image_ref"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_run" ADD CONSTRAINT "extraction_run_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE no action ON UPDATE no action;