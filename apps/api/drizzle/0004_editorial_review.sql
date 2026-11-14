ALTER TYPE "public"."validation_status" ADD VALUE 'published';--> statement-breakpoint
CREATE TABLE "revision_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"action" text NOT NULL,
	"actor_id" text NOT NULL,
	"actor_role" text NOT NULL,
	"from_status" "validation_status",
	"to_status" "validation_status" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "revision_event_action" CHECK ("revision_event"."action" in ('created','edited','merged','submit','validate','reject','publish')),
	CONSTRAINT "revision_event_actor" CHECK (length("revision_event"."actor_id") > 0)
);
--> statement-breakpoint
ALTER TABLE "revision_event" ADD CONSTRAINT "revision_event_record_id_archive_record_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."archive_record"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_event" ADD CONSTRAINT "revision_event_revision_id_record_revision_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."record_revision"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TRIGGER protect_revision_event BEFORE UPDATE OR DELETE ON revision_event FOR EACH ROW EXECUTE FUNCTION protect_revision_child();
--> statement-breakpoint
CREATE INDEX revision_event_record_idx ON revision_event (record_id, created_at);
