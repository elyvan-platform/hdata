import { PGlite } from "@electric-sql/pglite";
import { searchResponseSchema } from "@hdata/domain";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { importRecord } from "../archive/import-record.ts";
import { importIndex } from "../archive/store-index.ts";
import { createCatalogService } from "../catalog/refresh-catalog.ts";
import { decide, editRevision, getFiche } from "../editorial/service.ts";
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
				originalText: publish
					? "Compareceu, Eufrásia de Sousa; testemunha."
					: "segredo apenas no rascunho",
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

	it("searches published manuscript text and never exposes unpublished records", async () => {
		expect((await search("?q=rascunho")).total).toBe(0);
		expect((await search("?q=!!!")).total).toBe(0);
		expect((await search("?q=segredo")).total).toBe(0);
		const found = await search("?q=eufrasia sousa");
		expect(found.total).toBe(2);
		expect(found.results[0]?.excerpt).toContain("Eufrásia de Sousa");
		expect(found.results[0]?.images[0]?.url).toBe("https://example.org/i/1");
		expect(found.results[0]?.participants.some((p) => p.name.includes("Eufrásia"))).toBe(false);
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
			{ referenceCode: "PT/1", title: "Livro PT/1", publishedRecords: 1, publishedPages: 1 },
			{ referenceCode: "PT/2", title: "Livro PT/2", publishedRecords: 1, publishedPages: 0 },
			{ referenceCode: "PT/3", title: "Livro PT/3", publishedRecords: 0, publishedPages: 0 },
		]);
	});
});

// Release acceptance uses invented people and example.org URLs, never historical evidence.
describe("release acceptance (synthetic)", () => {
	it("opens baptism and marriage with their source and participant roles", async () => {
		const baptism = await search("?type=baptism&q=joao");
		expect(baptism.results[0]).toMatchObject({
			recordId: records["João Álvares"],
			locator: "f. 1",
			origin: { sourceKind: "index" },
			book: {
				referenceCode: "PT/1",
				recordUrl: "https://example.org/r",
				viewerUrl: "https://example.org/v",
			},
		});
		const marriage = await importRecord(pool, {
			sourceId,
			bookId: books["PT/2"],
			externalId: "synthetic-marriage",
			revision: {
				recordType: "marriage",
				provenance: { sourceId, method: "import" },
				participants: [
					{ role: "groom", nameAsWritten: "Noivo Sintético", position: 0 },
					{ role: "bride", nameAsWritten: "Noiva Sintética", position: 1 },
				],
			},
		});
		for (const [actor, action] of [
			[editor, "submit"],
			[reviewer, "validate"],
			[publisher, "publish"],
		] as const)
			await decide(pool, actor, marriage.recordId, action, { revisionId: marriage.revisionId });
		const found = await search("?type=marriage&q=sintetico");
		expect(found.results[0]?.participants.map((p) => p.role)).toEqual(["groom", "bride"]);
		expect((await search("?type=marriage&q=sintetico&from=1800&to=2000")).total).toBe(0);
	});

	it("keeps death books without indexed seats visible and separates a secondary index from publication", async () => {
		expect(await search("?type=death&book=PT/3")).toMatchObject({ total: 0, results: [] });
		expect((await app.inject("/search/coverage")).json().books).toContainEqual({
			referenceCode: "PT/3",
			title: "Livro PT/3",
			publishedRecords: 0,
			publishedPages: 0,
		});
		const input = {
			sourceId,
			bookId: books["PT/3"],
			externalId: "synthetic-death",
			revision: {
				recordType: "death",
				date: { year: 1880, precision: "year" },
				provenance: { sourceId, method: "import", locator: "f. 9" },
				participants: [{ role: "deceased", nameAsWritten: "Pessoa Sintética", position: 0 }],
			},
		};
		const ids = await importRecord(pool, input);
		const rows = [
			{ id: "synthetic-death", text: "Índice sintético", book: "PT/3", locator: "f. 9" },
		];
		const mapping = {
			sourceId,
			citation: "Synthetic release fixture",
			reuseEvidence: "Invented data",
			kind: "index",
			recordType: "death",
			columns: { externalId: "id", text: "text", bookReference: "book", locator: "locator" },
		};
		await importIndex(pool, rows, mapping, true);
		expect((await search("?type=death")).total).toBe(0);
		await decide(pool, editor, ids.recordId, "submit", { revisionId: ids.revisionId });
		await decide(pool, reviewer, ids.recordId, "validate", { revisionId: ids.revisionId });
		await decide(pool, publisher, ids.recordId, "publish", { revisionId: ids.revisionId });
		expect((await getFiche(pool, reviewer, ids.recordId)).secondaryIndex).toHaveLength(1);
		expect((await search("?type=death&book=PT/3&from=1870&to=1890")).total).toBe(1);
		expect((await search("?type=death&book=PT/3&from=1890")).total).toBe(0);
		const before = await search("?type=death");
		expect(await importRecord(pool, input)).toEqual(ids);
		expect((await importIndex(pool, rows, mapping, true)).unchanged).toHaveLength(1);
		expect(await search("?type=death")).toEqual(before);
		const fiche = await getFiche(pool, editor, ids.recordId);
		const edited = await editRevision(pool, editor, ids.recordId, {
			baseRevisionId: ids.revisionId,
			content: { ...fiche.current.content, placeAsWritten: "Lugar Sintético" },
		});
		expect(edited.revision.status).toBe("draft");
		expect((await search("?q=lugar&type=death")).total).toBe(0);
		expect(await search("?type=death")).toEqual(before);
		await decide(pool, editor, ids.recordId, "submit", { revisionId: edited.revision.id });
		await decide(pool, reviewer, ids.recordId, "validate", { revisionId: edited.revision.id });
		await decide(pool, publisher, ids.recordId, "publish", { revisionId: edited.revision.id });
		expect((await search("?q=lugar&type=death")).results[0]?.place).toBe("Lugar Sintético");
	});

	it("preserves catalog identity and published search through reimport and Digitarq 5xx", async () => {
		let down = false;
		const fondsReference = "PT/SYNTHETIC";
		const service = createCatalogService({
			pool,
			url: "https://example.org/catalog",
			fondsReference,
			timeoutMs: 500,
			fetch: async () =>
				new Response(
					JSON.stringify(
						down
							? {}
							: {
									fondsReference,
									title: "Synthetic",
									expectedBookCount: 1,
									books: [{ referenceCode: `${fondsReference}/1`, title: "Synthetic book" }],
								},
					),
					{ status: down ? 503 : 200 },
				),
		});
		const server = buildApp({
			env: parseEnv({ NODE_ENV: "test", CATALOG_REFRESH_TOKEN: "synthetic-release-token" }),
			database: { ping: async () => {}, close: async () => {} },
			catalog: service,
			search: { pool },
		});
		try {
			const request = {
				method: "POST",
				url: "/catalog/refresh",
				headers: { authorization: "Bearer synthetic-release-token" },
			} as const;
			expect((await server.inject(request)).statusCode).toBe(200);
			const stored = (await db.query("SELECT id FROM book ORDER BY id")).rows;
			const before = (await server.inject("/search")).json();
			expect((await server.inject(request)).json().unchanged).toBe(true);
			down = true;
			expect((await server.inject(request)).statusCode).toBe(502);
			const catalog = await server.inject("/catalog");
			expect(catalog.statusCode).toBe(200);
			expect(catalog.json().status.data).toBe("stored_copy");
			expect((await db.query("SELECT id FROM book ORDER BY id")).rows).toEqual(stored);
			expect((await server.inject("/search")).json()).toEqual(before);
			const record = await server.inject(`/records/${records["João Álvares"]}`);
			expect(record.statusCode).toBe(200);
			expect(record.json()).toMatchObject({
				book: { recordUrl: "https://example.org/r", viewerUrl: "https://example.org/v" },
				images: [{ folio: "3", url: "https://example.org/i/1" }],
			});
		} finally {
			await server.close();
		}
	});
});

describe("published death transcription", () => {
	it("finds a name absent from participants and isolates a later draft", async () => {
		const { recordId, revisionId } = await importRecord(pool, {
			sourceId,
			bookId: books["PT/3"],
			externalId: "death-transcription",
			revision: {
				recordType: "death",
				originalText: `${"Texto introdutório. ".repeat(30)}Faleceu, Quitéria de Brito.`,
				provenance: { sourceId, method: "import", locator: "m0006" },
				participants: [],
			},
		});
		await decide(pool, editor, recordId, "submit", { revisionId });
		await decide(pool, reviewer, recordId, "validate", { revisionId });
		await decide(pool, publisher, recordId, "publish", { revisionId });
		const found = await search("?q=quiteria&type=death");
		expect(found.total).toBe(1);
		expect(found.results[0]).toMatchObject({ recordId, locator: "m0006", status: "published" });
		expect(found.results[0]?.excerpt).toContain("Quitéria");
		expect(found.results[0]?.excerpt?.length).toBeLessThanOrEqual(282);
		const fiche = await getFiche(pool, editor, recordId);
		expect(fiche).not.toBeNull();
		if (!fiche) throw new Error("Missing fiche");
		await editRevision(pool, editor, recordId, {
			baseRevisionId: revisionId,
			content: { ...fiche.current.content, originalText: "Nomeprivado" },
		});
		expect((await search("?q=nomeprivado")).total).toBe(0);
		expect((await search("?q=quiteria&type=death")).total).toBe(1);
	});
});
