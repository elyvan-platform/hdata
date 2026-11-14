ALTER TABLE "extraction_run" ADD COLUMN "lease_until" timestamp with time zone;
--> statement-breakpoint
UPDATE extraction_run SET lease_until=now() WHERE status='running';
