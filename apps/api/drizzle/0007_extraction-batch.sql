CREATE TABLE "extraction_batch_budget" (
	"id" text PRIMARY KEY NOT NULL,
	"manifest_hash" text NOT NULL,
	"max_calls" integer NOT NULL,
	"reserved_calls" integer DEFAULT 0 NOT NULL
);
