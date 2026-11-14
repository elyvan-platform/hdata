import { PGlite } from "@electric-sql/pglite";
import type { CatalogSnapshot } from "@hdata/domain";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { parseEnv } from "../env/index.ts";
import { CatalogError, fetchCatalog, validateSnapshot } from "./digitarq-adapter.ts";
import { reconcileCatalog } from "./reconcile-catalog.ts";
import { createCatalogService } from "./refresh-catalog.ts";

const FONDS = "PT/ADPRT/PRQ/PAMT38";
const book = (n: number, viewer = true) => ({
	referenceCode: `${FONDS}/${n}`,
	title: `Livro ${n}`,
	recordUrl: `https://example.test/ficha/${n}`,
	...(viewer ? { viewerUrl: `https://example.test/ver/${n}` } : {}),
});
const snapshot = (n = 3): CatalogSnapshot => ({
	fondsReference: FONDS,
	title: "Fundo",
	expectedBookCount: n,
	books: Array.from({ length: n }, (_, i) => book(i + 1)),
});
const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function setup(fetchImpl: typeof fetch) {
	const client = await PGlite.create();
	await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
	// PGlite is single-connection: serialise transactions like a one-connection pool.
	let chain: Promise<unknown> = Promise.resolve();
	const pool = {
		query: (q: string, p?: unknown[]) => client.query(q, p),
		connect: async () => {
			let done: () => void = () => {};
			const turn = chain;
			chain = new Promise<void>((r) => {
				done = r;
			});
			await turn;
			return { query: (q: string, p?: unknown[]) => client.query(q, p), release: () => done() };
		},
	} as unknown as Pool;
	const service = createCatalogService({
		pool,
		url: "https://digitarq.test/catalog",
		fondsReference: FONDS,
		timeoutMs: 500,
		fetch: fetchImpl,
	});
	return { client, pool, service };
}

describe("adapter", () => {
	const opts = { url: "https://x.test", fondsReference: FONDS, timeoutMs: 200, retries: 0 };
	it("rejects incomplete, duplicate and foreign responses", () => {
		expect(() => validateSnapshot({ ...snapshot(3), expectedBookCount: 4 }, FONDS)).toThrow(
			expect.objectContaining({ code: "incomplete" }),
		);
		const dup = snapshot(2);
		dup.books[1] = dup.books[0] as (typeof dup.books)[number];
		expect(() => validateSnapshot(dup, FONDS)).toThrow(
			expect.objectContaining({ code: "invalid_format" }),
		);
		expect(() => validateSnapshot({ ...snapshot(), fondsReference: "X" }, FONDS)).toThrow(
			CatalogError,
		);
		expect(() => validateSnapshot("<html>", FONDS)).toThrow(
			expect.objectContaining({ code: "invalid_format" }),
		);
	});
	it("maps HTTP, network and timeout failures", async () => {
		const code = (f: typeof fetch) =>
			fetchCatalog({ ...opts, fetch: f }).catch((e: CatalogError) => e.code);
		expect(await code(async () => json({}, 403))).toBe("refused");
		expect(await code(async () => json({}, 429))).toBe("rate_limited");
		expect(await code(async () => json({}, 500))).toBe("http_error");
		expect(await code(async () => new Response("<html>"))).toBe("invalid_format");
		expect(await code(async () => Promise.reject(new TypeError("fetch failed")))).toBe("network");
		expect(
			await code(
				(_u, init) =>
					new Promise((_, reject) =>
						init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)),
					),
			),
		).toBe("timeout");
	});
	it("retries transient failures only", async () => {
		let calls = 0;
		const result = await fetchCatalog({
			...opts,
			retries: 1,
			fetch: async () => (++calls === 1 ? json({}, 503) : json(snapshot())),
		});
		expect(result.books).toHaveLength(3);
		calls = 0;
		await expect(
			fetchCatalog({
				...opts,
				retries: 3,
				fetch: async () => {
					calls++;
					return json({}, 403);
				},
			}),
		).rejects.toThrow(CatalogError);
		expect(calls).toBe(1);
	});
});

describe("reconcileCatalog", () => {
	it("reports identity differences even when totals match", () => {
		const stored = [
			{
				referenceCode: `${FONDS}/1`,
				title: "Livro 1",
				shelfmark: null,
				folioCount: null,
				recordUrl: `https://example.test/ficha/1`,
				viewerUrl: null,
			},
			{
				referenceCode: `${FONDS}/9`,
				title: "Livro 9",
				shelfmark: null,
				folioCount: null,
				recordUrl: null,
				viewerUrl: `https://example.test/ver/9`,
			},
		];
		const report = reconcileCatalog(snapshot(2), stored, { books: 2, viewers: 1 });
		expect(report.added).toEqual([`${FONDS}/2`]);
		expect(report.missing).toEqual([`${FONDS}/9`]);
		expect(report.viewersAdded).toEqual([`${FONDS}/1`, `${FONDS}/2`]);
		expect(report.pendingReview).toEqual([`${FONDS}/9`]);
		expect(report.bookDelta).toBe(0);
		expect(report.viewerDelta).toBe(1);
	});
});

describe("catalog service", () => {
	it("imports idempotently and keeps ids on re-import", async () => {
		const { client, service } = await setup(async () => json(snapshot()));
		expect((await service.status()).data).toBe("none");
		const first = await service.refresh();
		expect(first.unchanged).toBe(false);
		const ids = await client.query("SELECT id FROM book ORDER BY external_id");
		const second = await service.refresh();
		expect(second.unchanged).toBe(true);
		expect(await client.query("SELECT id FROM book ORDER BY external_id")).toEqual(ids);
		const counts = await client.query<{ n: number }>(
			"SELECT (SELECT count(*) FROM catalog_version)::int AS n",
		);
		expect(counts.rows[0]?.n).toBe(1);
		const list = await service.list();
		expect(list.books).toHaveLength(3);
		expect(list.status.data).toBe("fresh");
		expect(list.status.reconciliation?.added).toHaveLength(3);
	});

	it("updates changed links without duplicating books", async () => {
		let current = snapshot();
		const { client, service } = await setup(async () => json(current));
		await service.refresh();
		current = {
			...snapshot(),
			books: [{ ...book(1), viewerUrl: "https://example.test/novo" }, book(2), book(3)],
		};
		const result = await service.refresh();
		expect(result.unchanged).toBe(false);
		expect(result.status.reconciliation?.changed).toEqual([`${FONDS}/1`]);
		const n = await client.query<{ n: number }>("SELECT count(*)::int AS n FROM book");
		expect(n.rows[0]?.n).toBe(3);
	});

	it("serves the stored copy after a failure and never replaces it with a partial response", async () => {
		let mode: "ok" | "partial" | "down" = "ok";
		const { client, service } = await setup(async () => {
			if (mode === "down") return json({}, 403);
			return json(mode === "partial" ? { ...snapshot(), expectedBookCount: 9 } : snapshot());
		});
		await service.refresh();
		mode = "partial";
		await expect(service.refresh()).rejects.toMatchObject({ code: "incomplete" });
		mode = "down";
		await expect(service.refresh()).rejects.toMatchObject({ code: "refused" });
		const list = await service.list();
		expect(list.books).toHaveLength(3);
		expect(list.status.data).toBe("stored_copy");
		expect(list.status.lastAttempt?.outcome).toBe("failure");
		expect(list.status.lastSuccessAt).not.toBeNull();
		const versions = await client.query<{ n: number }>(
			"SELECT count(*)::int AS n FROM catalog_version",
		);
		expect(versions.rows[0]?.n).toBe(1);
	});

	it("reports failure without a catalog as none, not as an empty list", async () => {
		const { service } = await setup(async () => json({}, 500));
		await expect(service.refresh()).rejects.toMatchObject({ code: "http_error" });
		const list = await service.list();
		expect(list.status.data).toBe("none");
		expect(list.status.lastAttempt?.outcome).toBe("failure");
	});

	it("does not delete books or viewers that disappear", async () => {
		let current = snapshot();
		const { service } = await setup(async () => json(current));
		await service.refresh();
		current = { ...snapshot(2), books: [book(1, false), book(2)] };
		const result = await service.refresh();
		expect(result.status.reconciliation?.pendingReview).toEqual([`${FONDS}/1`, `${FONDS}/3`]);
		const list = await service.list();
		expect(list.books).toHaveLength(3);
		expect(list.books[0]?.viewerUrl).toBe("https://example.test/ver/1");
	});

	it("serialises concurrent refreshes", async () => {
		const { client, service } = await setup(async () => json(snapshot()));
		await Promise.all([service.refresh(), service.refresh(), service.refresh()]);
		const n = await client.query<{ b: number; v: number; s: number }>(
			"SELECT (SELECT count(*) FROM book)::int AS b, (SELECT count(*) FROM catalog_version)::int AS v, (SELECT count(*) FROM source)::int AS s",
		);
		expect(n.rows[0]).toEqual({ b: 3, v: 1, s: 1 });
	});
});

describe("catalog routes", () => {
	const token = "0123456789abcdef0123";
	async function app(fetchImpl: typeof fetch, withToken = true) {
		const { service } = await setup(fetchImpl);
		return buildApp({
			env: parseEnv({ NODE_ENV: "test", ...(withToken ? { CATALOG_REFRESH_TOKEN: token } : {}) }),
			database: { ping: async () => {}, close: async () => {} },
			catalog: service,
		});
	}
	const auth = { authorization: `Bearer ${token}` };

	it("requires a token and reports typed failures", async () => {
		const server = await app(async () => json({}, 403));
		expect((await server.inject({ method: "POST", url: "/catalog/refresh" })).statusCode).toBe(401);
		const failed = await server.inject({ method: "POST", url: "/catalog/refresh", headers: auth });
		expect(failed.statusCode).toBe(502);
		expect(failed.json()).toMatchObject({ error: "refused", status: { data: "none" } });
		const list = await server.inject("/catalog");
		expect(list.json()).toMatchObject({ books: [], status: { data: "none" } });
		await server.close();
	});

	it("refreshes on request and disables refresh without a token", async () => {
		const server = await app(async () => json(snapshot()));
		const ok = await server.inject({ method: "POST", url: "/catalog/refresh", headers: auth });
		expect(ok.statusCode).toBe(200);
		expect(ok.json()).toMatchObject({ bookCount: 3, status: { data: "fresh" } });
		await server.close();
		const off = await app(async () => json(snapshot()), false);
		expect(
			(await off.inject({ method: "POST", url: "/catalog/refresh", headers: auth })).statusCode,
		).toBe(403);
		await off.close();
	});
});
