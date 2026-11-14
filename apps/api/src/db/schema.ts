import { recordTypes, validationStatuses } from "@hdata/domain";
import { sql } from "drizzle-orm";
import {
	check,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

export const recordType = pgEnum("record_type", recordTypes);
export const validationStatus = pgEnum("validation_status", validationStatuses);
const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
export const sources = pgTable("source", {
	id: id(),
	name: text("name").notNull(),
	kind: text("kind").notNull(),
	citation: text("citation"),
	url: text("url"),
	rightsStatus: text("rights_status").notNull().default("unknown"),
	accessedAt: timestamp("accessed_at", { withTimezone: true }),
});
export const archivalUnits = pgTable(
	"archival_unit",
	{
		id: id(),
		sourceId: uuid("source_id")
			.notNull()
			.references(() => sources.id),
		externalId: text("external_id"),
		parentId: uuid("parent_id"),
		level: text("level").notNull(),
		referenceCode: text("reference_code"),
		title: text("title").notNull(),
		startDate: jsonb("start_date"),
		endDate: jsonb("end_date"),
	},
	(t) => [
		uniqueIndex("archival_unit_external_unique")
			.on(t.sourceId, t.externalId)
			.where(sql`${t.externalId} is not null`),
		check("archival_unit_level", sql`${t.level} in ('fonds','series','subseries')`),
	],
);
export const books = pgTable(
	"book",
	{
		id: id(),
		sourceId: uuid("source_id")
			.notNull()
			.references(() => sources.id),
		externalId: text("external_id"),
		archivalUnitId: uuid("archival_unit_id")
			.notNull()
			.references(() => archivalUnits.id),
		referenceCode: text("reference_code"),
		shelfmark: text("shelfmark"),
		title: text("title").notNull(),
		startDate: jsonb("start_date"),
		endDate: jsonb("end_date"),
		folioCount: integer("folio_count"),
		sourceUrl: text("source_url"),
		viewerUrl: text("viewer_url"),
	},
	(t) => [
		uniqueIndex("book_external_unique")
			.on(t.sourceId, t.externalId)
			.where(sql`${t.externalId} is not null`),
		check("book_folio_count", sql`${t.folioCount} >= 0`),
	],
);
export const images = pgTable(
	"image_ref",
	{
		id: id(),
		sourceId: uuid("source_id")
			.notNull()
			.references(() => sources.id),
		externalId: text("external_id"),
		bookId: uuid("book_id")
			.notNull()
			.references(() => books.id),
		sequence: integer("sequence").notNull(),
		folio: text("folio"),
		side: text("side").notNull().default("unknown"),
		url: text("url"),
		storageKey: text("storage_key"),
		rightsStatus: text("rights_status").notNull().default("unknown"),
	},
	(t) => [
		uniqueIndex("image_external_unique")
			.on(t.sourceId, t.externalId)
			.where(sql`${t.externalId} is not null`),
		unique("image_sequence_unique").on(t.bookId, t.sequence),
		check("image_sequence_nonnegative", sql`${t.sequence} >= 0`),
		check("image_side", sql`${t.side} in ('recto','verso','unknown')`),
	],
);
export const importBatches = pgTable(
	"import_batch",
	{
		id: id(),
		sourceId: uuid("source_id")
			.notNull()
			.references(() => sources.id),
		externalId: text("external_id"),
		createdAt: createdAt(),
	},
	(t) => [unique("batch_external_unique").on(t.sourceId, t.externalId)],
);
export const records = pgTable(
	"archive_record",
	{
		id: id(),
		sourceId: uuid("source_id")
			.notNull()
			.references(() => sources.id),
		externalId: text("external_id"),
		bookId: uuid("book_id")
			.notNull()
			.references(() => books.id),
		recordType: recordType("record_type").notNull(),
		createdAt: createdAt(),
	},
	(t) => [
		uniqueIndex("record_external_unique")
			.on(t.sourceId, t.externalId)
			.where(sql`${t.externalId} is not null`),
	],
);
export const revisions = pgTable(
	"record_revision",
	{
		id: id(),
		recordId: uuid("record_id")
			.notNull()
			.references(() => records.id),
		revisionNumber: integer("revision_number").notNull(),
		contentHash: text("content_hash").notNull(),
		date: jsonb("date"),
		folio: text("folio"),
		placeAsWritten: text("place_as_written"),
		normalizedPlace: text("normalized_place"),
		originalText: text("original_text"),
		marginalNotes: text("marginal_notes"),
		status: validationStatus("status").notNull().default("draft"),
		sourceId: uuid("source_id")
			.notNull()
			.references(() => sources.id),
		method: text("method").notNull(),
		importBatchId: uuid("import_batch_id").references(() => importBatches.id),
		locator: text("locator"),
		recordedBy: text("recorded_by"),
		recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
		supersedesRevisionId: uuid("supersedes_revision_id"),
	},
	(t) => [
		unique("revision_number_unique").on(t.recordId, t.revisionNumber),
		unique("revision_hash_unique").on(t.recordId, t.contentHash),
		check("revision_method", sql`${t.method} in ('manual','import')`),
		check("revision_number_positive", sql`${t.revisionNumber} > 0`),
	],
);
export const participants = pgTable(
	"participant",
	{
		id: id(),
		revisionId: uuid("revision_id")
			.notNull()
			.references(() => revisions.id),
		role: text("role").notNull(),
		nameAsWritten: text("name_as_written").notNull(),
		normalizedName: text("normalized_name"),
		legibility: text("legibility").notNull().default("legible"),
		roleAsWritten: text("role_as_written"),
		notes: text("notes"),
		position: integer("position").notNull(),
	},
	(t) => [unique("participant_position_unique").on(t.revisionId, t.position)],
);
export const revisionImages = pgTable(
	"record_revision_image",
	{
		revisionId: uuid("revision_id")
			.notNull()
			.references(() => revisions.id),
		imageId: uuid("image_id")
			.notNull()
			.references(() => images.id),
		region: jsonb("region"),
	},
	(t) => [unique("revision_image_unique").on(t.revisionId, t.imageId)],
);
export const catalogVersions = pgTable("catalog_version", {
	id: id(),
	sourceId: uuid("source_id")
		.notNull()
		.references(() => sources.id),
	fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
	contentHash: text("content_hash").notNull(),
	bookCount: integer("book_count").notNull(),
	viewerCount: integer("viewer_count").notNull(),
	reconciliation: jsonb("reconciliation").notNull(),
});
export const catalogRefreshes = pgTable(
	"catalog_refresh",
	{
		id: id(),
		sourceId: uuid("source_id")
			.notNull()
			.references(() => sources.id),
		attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
		outcome: text("outcome").notNull(),
		versionId: uuid("version_id").references(() => catalogVersions.id),
		errorCode: text("error_code"),
		message: text("message"),
		durationMs: integer("duration_ms"),
	},
	(t) => [check("catalog_refresh_outcome", sql`${t.outcome} in ('success','failure')`)],
);

/** Immutable source snapshots; editorial conflicts never overwrite richer evidence. */
export const historicalEntries = pgTable(
	"historical_entry",
	{
		id: id(),
		sourceId: uuid("source_id")
			.notNull()
			.references(() => sources.id),
		externalId: text("external_id").notNull(),
		contentHash: text("content_hash").notNull(),
		payload: jsonb("payload").notNull(),
		createdAt: createdAt(),
	},
	(t) => [unique("historical_entry_hash_unique").on(t.sourceId, t.externalId, t.contentHash)],
);
