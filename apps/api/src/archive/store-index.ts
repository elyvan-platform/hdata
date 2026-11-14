import { historicalStoredEntrySchema } from "@hdata/domain";
import type { Pool } from "pg";
import { entryHash, previewIndex } from "./preview-index.ts";

/** Recompute preview under a lock; one failed entry rolls back the complete import. */
export async function importIndex(pool: Pool, rows: unknown[], mapping: unknown, apply = false) {
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		await client.query("SELECT pg_advisory_xact_lock(731905)");
		const saved = await client.query<{ payload: unknown }>(
			"SELECT payload FROM historical_entry ORDER BY created_at, id",
		);
		const report = previewIndex(
			rows,
			mapping,
			saved.rows.map((row) => historicalStoredEntrySchema.parse(row.payload)),
		);
		if (apply) {
			for (const candidate of report.candidates)
				await client.query(
					"INSERT INTO historical_entry (source_id,external_id,content_hash,payload) VALUES ($1,$2,$3,$4) ON CONFLICT (source_id,external_id,content_hash) DO NOTHING",
					[
						candidate.sourceId,
						candidate.entry.externalId,
						entryHash(candidate),
						JSON.stringify(candidate),
					],
				);
		}
		await client.query("COMMIT");
		return report;
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
}
