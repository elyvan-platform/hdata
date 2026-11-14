ALTER TABLE archival_unit ADD CONSTRAINT archival_unit_parent_fk FOREIGN KEY (parent_id) REFERENCES archival_unit(id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE record_revision ADD CONSTRAINT revision_previous_fk FOREIGN KEY (supersedes_revision_id) REFERENCES record_revision(id) ON DELETE RESTRICT;
--> statement-breakpoint
CREATE FUNCTION protect_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'revisions are immutable'; END IF;
  IF (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
    RAISE EXCEPTION 'revision content is immutable';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER protect_revision BEFORE UPDATE OR DELETE ON record_revision FOR EACH ROW EXECUTE FUNCTION protect_revision();
--> statement-breakpoint
CREATE FUNCTION protect_revision_child() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'revision snapshots are immutable';
END $$;
--> statement-breakpoint
CREATE TRIGGER protect_participant BEFORE UPDATE OR DELETE ON participant FOR EACH ROW EXECUTE FUNCTION protect_revision_child();
--> statement-breakpoint
CREATE TRIGGER protect_revision_image BEFORE UPDATE OR DELETE ON record_revision_image FOR EACH ROW EXECUTE FUNCTION protect_revision_child();
--> statement-breakpoint
CREATE FUNCTION valid_partial_date(d jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE y integer; m integer; dy integer; precision text; qualifier text;
BEGIN
  IF d IS NULL THEN RETURN true; END IF;
  IF jsonb_typeof(d) <> 'object' THEN RETURN false; END IF;
  precision := d->>'precision'; qualifier := COALESCE(d->>'qualifier', 'exact');
  IF qualifier NOT IN ('exact','circa','before','after','uncertain') THEN RETURN false; END IF;
  IF d ? 'year' THEN y := (d->>'year')::integer; IF y < 1 OR y > 9999 THEN RETURN false; END IF; END IF;
  IF d ? 'month' THEN m := (d->>'month')::integer; IF y IS NULL OR m < 1 OR m > 12 THEN RETURN false; END IF; END IF;
  IF d ? 'day' THEN dy := (d->>'day')::integer; IF m IS NULL OR dy < 1 OR dy > 31 THEN RETURN false; END IF; PERFORM make_date(y,m,dy); END IF;
  RETURN CASE WHEN dy IS NOT NULL THEN precision = 'day' WHEN m IS NOT NULL THEN precision = 'month' WHEN y IS NOT NULL THEN precision = 'year' ELSE precision = 'unknown' END IS TRUE;
EXCEPTION WHEN others THEN RETURN false;
END $$;
--> statement-breakpoint
ALTER TABLE archival_unit ADD CONSTRAINT unit_dates_valid CHECK (valid_partial_date(start_date) AND valid_partial_date(end_date));
--> statement-breakpoint
ALTER TABLE book ADD CONSTRAINT book_dates_valid CHECK (valid_partial_date(start_date) AND valid_partial_date(end_date));
--> statement-breakpoint
ALTER TABLE record_revision ADD CONSTRAINT revision_date_valid CHECK (valid_partial_date(date));
