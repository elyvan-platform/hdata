import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Pool } from "pg";
import { expect, it } from "vitest";
import { importIndex } from "./store-index.ts";

it("stages atomically, previews without writing, reimports idempotently and preserves conflicting versions", async () => {
	const db = await PGlite.create();
	try {
		await migrate(drizzle(db), { migrationsFolder: "./drizzle" });
		const sourceId = "00000000-0000-4000-8000-000000000001";
		await db.query("INSERT INTO source (id,name,kind) VALUES ($1,'Synthetic','index')", [sourceId]);
		const pool = {
			connect: async () => ({
				query: (sql: string, params: unknown[]) => db.query(sql, params),
				release: () => {},
			}),
		} as unknown as Pool;
		const config = {
			sourceId,
			citation: "Synthetic",
			reuseEvidence: "Own synthetic data",
			kind: "index",
			recordType: "baptism",
			columns: { externalId: "id", text: "text", tif: "tif" },
		};
		const rows = [{ id: "1", text: "original", tif: "m0006.TIF", extra: "complete" }];
		await importIndex(pool, rows, config);
		expect((await db.query("SELECT * FROM historical_entry")).rows).toHaveLength(0);
		await importIndex(pool, rows, config, true);
		const repeated = await importIndex(pool, rows, config, true);
		expect(repeated.unchanged).toHaveLength(1);
		expect((await db.query("SELECT * FROM historical_entry")).rows).toHaveLength(1);
		const conflict = await importIndex(pool, [{ id: "1", text: "changed" }], config, true);
		expect(conflict.conflicts).toHaveLength(1);
		const versions = await db.query<{ payload: { entry: { raw: unknown } } }>(
			"SELECT payload FROM historical_entry ORDER BY created_at",
		);
		expect(versions.rows).toHaveLength(2);
		expect(versions.rows[0]?.payload.entry.raw).toEqual(rows[0]);
		expect(
			(await importIndex(pool, [{ id: "1", text: "changed" }], config)).conflicts,
		).toHaveLength(1);
		await expect(db.query("UPDATE historical_entry SET external_id='x'")).rejects.toThrow(
			"immutable",
		);
		await expect(db.query("DELETE FROM historical_entry")).rejects.toThrow("immutable");
		await expect(
			importIndex(
				pool,
				rows,
				{ ...config, sourceId: "00000000-0000-4000-8000-000000000002" },
				true,
			),
		).rejects.toThrow();
		expect((await db.query("SELECT * FROM historical_entry")).rows).toHaveLength(2);
		expect((await db.query("SELECT * FROM archive_record")).rows).toHaveLength(0);
	} finally {
		await db.close();
	}
});
