import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Pool } from "pg";
import { expect, it } from "vitest";
import { importRecord } from "../archive/import-record.ts";

it("applies migrations and preserves revision snapshots and external identities", async () => {
	const client = await PGlite.create();
	try {
		await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
		await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
		const source = await client.query<{ id: string }>(
			"INSERT INTO source (name,kind) VALUES ('Arquivo','primary') RETURNING id",
		);
		const sourceId = source.rows[0]?.id;
		const unit = await client.query<{ id: string }>(
			"INSERT INTO archival_unit (source_id,level,title) VALUES ($1,'fonds','Fundo') RETURNING id",
			[sourceId],
		);
		const book = await client.query<{ id: string }>(
			"INSERT INTO book (source_id,archival_unit_id,title,external_id) VALUES ($1,$2,'Livro','livro-1') RETURNING id",
			[sourceId, unit.rows[0]?.id],
		);
		await expect(
			client.query(
				"INSERT INTO book (source_id,archival_unit_id,title,external_id) VALUES ($1,$2,'Livro','livro-1')",
				[sourceId, unit.rows[0]?.id],
			),
		).rejects.toThrow();
		const record = await client.query<{ id: string }>(
			"INSERT INTO archive_record (source_id,book_id,external_id,record_type) VALUES ($1,$2,'assento-1','baptism') RETURNING id",
			[sourceId, book.rows[0]?.id],
		);
		await expect(
			client.query(
				"INSERT INTO record_revision (record_id,revision_number,content_hash,source_id,method,date) VALUES ($1,1,'invalid',$2,'manual',$3)",
				[
					record.rows[0]?.id,
					sourceId,
					JSON.stringify({ year: 1900, month: 2, day: 29, precision: "day" }),
				],
			),
		).rejects.toThrow();
		const pool = {
			connect: async () => ({
				query: (query: string, params: unknown[]) => client.query(query, params),
				release: () => {},
			}),
		} as unknown as Pool;
		const payload = {
			sourceId,
			bookId: book.rows[0]?.id,
			externalId: "import-1",
			revision: {
				recordType: "baptism",
				originalText: "original",
				provenance: { sourceId, method: "import", locator: "f. 2" },
				participants: [{ role: "child", nameAsWritten: "  João  ", position: 0 }],
			},
		};
		const first = await importRecord(pool, payload);
		const repeated = await importRecord(pool, payload);
		expect(repeated).toEqual(first);
		const changed = await importRecord(pool, {
			...payload,
			revision: { ...payload.revision, originalText: "correção" },
		});
		expect(changed.recordId).toBe(first.recordId);
		expect(changed.revisionId).not.toBe(first.revisionId);
		const history = await client.query<{ revision_number: number; original_text: string }>(
			"SELECT revision_number, original_text FROM record_revision WHERE record_id=$1 ORDER BY revision_number",
			[first.recordId],
		);
		expect(history.rows).toEqual([
			{ revision_number: 1, original_text: "original" },
			{ revision_number: 2, original_text: "correção" },
		]);
		const revision = await client.query<{ id: string }>(
			"INSERT INTO record_revision (record_id,revision_number,content_hash,source_id,method,original_text,locator) VALUES ($1,1,'hash',$2,'import','  João  ','f. 1') RETURNING id",
			[record.rows[0]?.id, sourceId],
		);
		const revisionId = revision.rows[0]?.id;
		await client.query(
			"INSERT INTO participant (revision_id,role,name_as_written,position) VALUES ($1,'child','  João  ',0)",
			[revisionId],
		);
		await expect(
			client.query("UPDATE record_revision SET original_text='changed' WHERE id=$1", [revisionId]),
		).rejects.toThrow();
		await expect(
			client.query("DELETE FROM participant WHERE revision_id=$1", [revisionId]),
		).rejects.toThrow();
		await client.query("UPDATE record_revision SET status='validated' WHERE id=$1", [revisionId]);
		const saved = await client.query<{ original_text: string; status: string }>(
			"SELECT original_text,status FROM record_revision WHERE id=$1",
			[revisionId],
		);
		expect(saved.rows[0]).toEqual({ original_text: "  João  ", status: "validated" });
	} finally {
		await client.close();
	}
});
