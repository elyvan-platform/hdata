import { PGlite } from "@electric-sql/pglite";
import { searchResponseSchema } from "@hdata/domain";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { importRecord } from "../archive/import-record.ts";
import { decide } from "../editorial/service.ts";
import type { Actor } from "../editorial/types.ts";
import { parseEnv } from "../env/index.ts";

const editor: Actor = { id: "ana", role: "editor" };
const reviewer: Actor = { id: "rita", role: "reviewer" };
const publisher: Actor = { id: "paulo", role: "publisher" };

let db: PGlite;
let pool: Pool;
let app: ReturnType<typeof buildApp>;
let sourceId: string;
const books: Record<string, string> = {};
const records: Record<string, string> = {};
let n = 0;

beforeAll(async () => {
	db = await PGlite.create();
	await migrate(drizzle(db), { migrationsFolder: "./drizzle" });
	const client = {
		connect: async () => ({
			query: (q: string, p?: unknown[]) => db.query(q, p),
			release: () => {},
		}),
		query: (q: string, p?: unknown[]) => db.query(q, p),
	};
	pool = client as unknown as Pool;
	sourceId = (
		await db.query<{ id: string }>(
			"INSERT INTO source (name,kind,rights_status) VALUES ('Índice','index','public-domain') RETURNING id",
		)
	).rows[0]?.id as string;
	const unit = (
		await db.query<{ id: string }>(
			"INSERT INTO archival_unit (source_id,level,title) VALUES ($1,'fonds','Fundo') RETURNING id",
			[sourceId],
		)
	).rows[0]?.id;
	for (const code of ["PT/1", "PT/2", "PT/3"]) {
		books[code] = (
			await db.query<{ id: string }>(
				"INSERT INTO book (source_id,archival_unit_id,title,reference_code,viewer_url,source_url) VALUES ($1,$2,$3,$4,'https://example.org/v','https://example.org/r') RETURNING id",
				[sourceId, unit, `Livro ${code}`, code],
			)
		).rows[0]?.id as string;
	}
	const image = (
		await db.query<{ id: string }>(
			"INSERT INTO image_ref (source_id,book_id,sequence,folio,url,rights_status) VALUES ($1,$2,1,'3','https://example.org/i/1','public-domain') RETURNING id",
			[sourceId, books["PT/1"]],
		)
	).rows[0]?.id;

	async function seed(
		name: string,
		book: string,
		extra: Record<string, unknown>,
		publish = true,
		participants: unknown[] = [],
	) {
		n += 1;
		const { recordId, revisionId } = await importRecord(pool, {
			sourceId,
			bookId: books[book] as string,
			externalId: `r-${n}`,
			revision: {
				recordType: "baptism",
				originalText: "texto secreto do manuscrito",
				provenance: { sourceId, method: "import", locator: `f. ${n}` },
				participants: [{ role: "child", nameAsWritten: name, position: 0 }, ...participants],
				...extra,
			},
		});
		records[name] = recordId;
		if (!publish) return;
		await decide(pool, editor, recordId, "submit", { revisionId });
		await decide(pool, reviewer, recordId, "validate", { revisionId });
		await decide(pool, publisher, recordId, "publish", { revisionId });
	}
	await seed(
		"João Álvares",
		"PT/1",
		{
			date: { year: 1850, month: 3, day: 12, precision: "day" },
			placeAsWritten: "Villa Cahiz",
			images: [{ imageId: image }],
		},
		true,
		[{ role: "father", nameAsWritten: "António Álvares", notes: "Ferreiro", position: 1 }],
	);
	await seed("Maria Joana", "PT/2", {
		recordType: "marriage",
		date: { year: 1900, precision: "year" },
	});
	await seed("João Rascunho", "PT/1", { date: { year: 1850, precision: "year" } }, false);
	app = buildApp({
		env: parseEnv({ NODE_ENV: "test" }),
		database: { ping: async () => {}, close: async () => {} },
		search: { pool },
	});
});
afterAll(async () => {
	await app.close();
	await db.close();
});

async function search(query: string) {
	const response = await app.inject(`/search${query}`);
	expect(response.statusCode).toBe(200);
	return searchResponseSchema.parse(response.json());
}

describe("search", () => {
	it("finds by name without accents and keeps the original spelling", async () => {
		const found = await search("?q=joao alvares");
		expect(found.results.map((r) => r.participants[0]?.name)).toEqual(["João Álvares"]);
		expect(found.results[0]?.book.viewerUrl).toBe("https://example.org/v");
		expect(found.results[0]?.images[0]).toMatchObject({
			folio: "3",
			url: "https://example.org/i/1",
		});
		expect(found.results[0]?.origin).toMatchObject({ sourceKind: "index", method: "import" });
	});

	it("finds by relative, profession, place variant and date", async () => {
		for (const q of ["antonio", "ferreiro", "vila caiz", "1850", "12/03/1850", "1850-03"])
			expect((await search(`?q=${encodeURIComponent(q)}`)).total, q).toBe(1);
	});

	it("never exposes unpublished records or manuscript text", async () => {
		expect((await search("?q=rascunho")).total).toBe(0);
		expect((await search("?q=secreto")).total).toBe(0);
		expect((await search("")).total).toBe(2);
		expect((await app.inject(`/records/${records["João Rascunho"]}`)).statusCode).toBe(404);
	});

	it("combines filters and paginates with a stable order", async () => {
		expect((await search("?type=marriage")).results.map((r) => r.recordType)).toEqual(["marriage"]);
		expect((await search("?book=PT/1")).total).toBe(1);
		expect((await search("?from=1860&to=1950")).total).toBe(1);
		expect((await search("?from=1860&to=1950&type=baptism")).total).toBe(0);
		const first = await search("?pageSize=1&page=1");
		const second = await search("?pageSize=1&page=2");
		expect(first.total).toBe(2);
		expect([first.results[0]?.recordId, second.results[0]?.recordId]).toEqual([
			records["João Álvares"],
			records["Maria Joana"],
		]);
		expect((await search("?pageSize=1&page=3")).results).toEqual([]);
	});

	it("rejects invalid queries with 400", async () => {
		expect((await app.inject("/search?type=nope")).statusCode).toBe(400);
		expect((await app.inject("/search?from=1900&to=1800")).statusCode).toBe(400);
		expect((await app.inject("/records/not-a-uuid")).statusCode).toBe(400);
	});

	it("opens a published record and reports real coverage", async () => {
		const response = await app.inject(`/records/${records["João Álvares"]}`);
		expect(response.statusCode).toBe(200);
		expect(response.json()).toMatchObject({ status: "published", place: "Villa Cahiz" });
		const coverage = (await app.inject("/search/coverage")).json();
		expect(coverage.publishedRecords).toBe(2);
		expect(coverage.books).toEqual([
			{ referenceCode: "PT/1", title: "Livro PT/1", publishedRecords: 1 },
			{ referenceCode: "PT/2", title: "Livro PT/2", publishedRecords: 1 },
			{ referenceCode: "PT/3", title: "Livro PT/3", publishedRecords: 0 },
		]);
	});
});
