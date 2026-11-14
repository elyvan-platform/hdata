import { createHash } from "node:crypto";
import { recordImportSchema } from "@hdata/domain";
import type { Pool } from "pg";

export function canonical(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
	if (value !== null && typeof value === "object")
		return `{${Object.entries(value)
			.filter(([, v]) => v !== undefined)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
			.join(",")}}`;
	return JSON.stringify(value) ?? "null";
}

/** Append a new snapshot under a row lock; identical imports reuse the existing revision. */
export async function importRecord(pool: Pool, input: unknown) {
	const data = recordImportSchema.parse(input);
	const { revision } = data;
	const hash = createHash("sha256").update(canonical(revision)).digest("hex");
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		await client.query(
			`INSERT INTO archive_record (source_id, external_id, book_id, record_type) VALUES ($1,$2,$3,$4) ON CONFLICT (source_id, external_id) WHERE external_id IS NOT NULL DO NOTHING`,
			[data.sourceId, data.externalId, data.bookId, revision.recordType],
		);
		const found = await client.query<{ id: string; book_id: string; record_type: string }>(
			`SELECT id, book_id, record_type FROM archive_record WHERE source_id=$1 AND external_id=$2 FOR UPDATE`,
			[data.sourceId, data.externalId],
		);
		const record = found.rows[0];
		if (!record || record.book_id !== data.bookId || record.record_type !== revision.recordType)
			throw new Error("External identity already belongs to a different book or record type");
		const existing = await client.query<{ id: string }>(
			"SELECT id FROM record_revision WHERE record_id=$1 AND content_hash=$2",
			[record.id, hash],
		);
		let revisionId = existing.rows[0]?.id;
		if (!revisionId) {
			const previous = await client.query<{ id: string; revision_number: number }>(
				"SELECT id, revision_number FROM record_revision WHERE record_id=$1 ORDER BY revision_number DESC LIMIT 1",
				[record.id],
			);
			const result = await client.query<{ id: string }>(
				`INSERT INTO record_revision (record_id, revision_number, content_hash, date, folio, place_as_written, normalized_place, original_text, marginal_notes, status, source_id, method, import_batch_id, locator, recorded_by, recorded_at, supersedes_revision_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft',$10,$11,$12,$13,$14,COALESCE($15::timestamptz,now()),$16) RETURNING id`,
				[
					record.id,
					(previous.rows[0]?.revision_number ?? 0) + 1,
					hash,
					revision.date ? JSON.stringify(revision.date) : null,
					revision.folio,
					revision.placeAsWritten,
					revision.normalizedPlace,
					revision.originalText,
					revision.marginalNotes,
					revision.provenance.sourceId,
					revision.provenance.method,
					revision.provenance.importBatchId,
					revision.provenance.locator,
					revision.provenance.recordedBy,
					revision.provenance.recordedAt,
					previous.rows[0]?.id,
				],
			);
			revisionId = result.rows[0]?.id;
			if (!revisionId) throw new Error("Revision insertion returned no id");
			for (const p of revision.participants)
				await client.query(
					"INSERT INTO participant (revision_id,role,name_as_written,normalized_name,legibility,role_as_written,notes,position) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
					[
						revisionId,
						p.role,
						p.nameAsWritten,
						p.normalizedName,
						p.legibility,
						p.roleAsWritten,
						p.notes,
						p.position,
					],
				);
			for (const image of revision.images)
				await client.query(
					"INSERT INTO record_revision_image (revision_id,image_id,region) VALUES ($1,$2,$3)",
					[revisionId, image.imageId, image.region ? JSON.stringify(image.region) : null],
				);
		}
		await client.query("COMMIT");
		return { recordId: record.id, revisionId };
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
}
