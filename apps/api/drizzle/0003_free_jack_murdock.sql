CREATE TABLE "historical_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"content_hash" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "historical_entry_hash_unique" UNIQUE("source_id","external_id","content_hash")
);
--> statement-breakpoint
ALTER TABLE "historical_entry" ADD CONSTRAINT "historical_entry_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE FUNCTION protect_historical_entry() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'historical source snapshots are immutable';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER historical_entry_immutable BEFORE UPDATE OR DELETE ON historical_entry
FOR EACH ROW EXECUTE FUNCTION protect_historical_entry();
