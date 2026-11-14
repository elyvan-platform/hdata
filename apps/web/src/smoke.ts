import { createApiClient } from "@hdata/api-client";
import { searchQuerySchema } from "@hdata/domain";
import { z } from "zod";

/** Approved real examples, supplied by the operator; never substitute fixtures. */
export const smokeManifestSchema = z.object({
	webUrl: z.url(),
	apiUrl: z.url(),
	commit: z
		.string()
		.min(1)
		.refine((value) => value !== "unknown"),
	books: z.number().int().positive(),
	viewers: z.number().int().positive(),
	publishedRecords: z.number().int().positive(),
	publishedPages: z.number().int().positive(),
	examples: z
		.array(
			z.object({
				recordId: z.uuid(),
				query: searchQuerySchema.refine(
					(query) => Boolean(query.q && query.type && query.book && query.from && query.to),
					"Supply a real name and combined type/book/year filters",
				),
			}),
		)
		.min(1),
});

function requireCheck(condition: boolean, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

/** Read-only post-deploy checks. A pass is evidence for these checks, not release approval. */
export async function runSmoke(input: unknown, doFetch: typeof fetch = fetch) {
	const manifest = smokeManifestSchema.parse(input);
	const evidence: string[] = [];
	const boundedFetch: typeof fetch = (url, init) =>
		doFetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
	const api = createApiClient({ baseUrl: manifest.apiUrl, fetch: boundedFetch });
	async function get(base: string, path: string) {
		const response = await boundedFetch(new URL(path, base));
		requireCheck(response.ok, `${path}: HTTP ${response.status}`);
		return response;
	}
	for (const base of [manifest.webUrl, manifest.apiUrl]) {
		for (const path of ["/health", "/ready"]) await get(base, path);
		const version = await get(base, "/version");
		const payload = z.object({ commit: z.string() }).parse(await version.json());
		requireCheck(payload.commit === manifest.commit, `Version mismatch: ${base}`);
		evidence.push(`${base}: health, ready, commit ${payload.commit}`);
	}
	for (const name of ["icone", "texto"]) {
		const path = `/brand/memoria-de-caiz-${name}.png`;
		const response = await get(manifest.webUrl, path);
		requireCheck(
			response.headers.get("content-type")?.split(";")[0] === "image/png",
			`${path}: expected PNG content type`,
		);
		const bytes = new Uint8Array(await response.arrayBuffer());
		requireCheck(
			bytes.length > 24 &&
				[137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte),
			`${path}: invalid PNG`,
		);
		evidence.push(`${path}: ${bytes.length} bytes`);
	}
	const home = await (await get(manifest.webUrl, "/")).text();
	requireCheck(
		/rel="icon"[^>]*href="\/brand\/memoria-de-caiz-icone.png"/.test(home),
		"Favicon does not reference the brand icon",
	);
	const catalog = await api.catalog();
	requireCheck(catalog.status.data !== "none", "No valid catalog");
	requireCheck(catalog.books.length === manifest.books, "Catalog book count mismatch");
	requireCheck(
		catalog.books.filter((book) => book.viewerUrl).length === manifest.viewers,
		"Catalog viewer count mismatch",
	);
	const coverage = await api.coverage();
	requireCheck(
		coverage.publishedRecords === manifest.publishedRecords,
		"Published record count mismatch",
	);
	requireCheck(
		coverage.publishedPages === manifest.publishedPages,
		"Published page count mismatch",
	);
	evidence.push(
		`catalog=${catalog.books.length}; viewers=${manifest.viewers}; records=${coverage.publishedRecords}; pages=${coverage.publishedPages}; catalog state=${catalog.status.data}`,
	);
	await get(manifest.webUrl, "/catalogo");
	for (const example of manifest.examples) {
		for (const query of [{ q: example.query.q }, example.query]) {
			const result = await api.search(query);
			requireCheck(
				result.total > 0 && result.results.some((record) => record.recordId === example.recordId),
				`Known record absent: ${example.recordId}`,
			);
			const params = new URLSearchParams();
			for (const [key, value] of Object.entries(query))
				if (value !== undefined) params.set(key, String(value));
			const html = await (await get(manifest.webUrl, `/?${params}`)).text();
			requireCheck(
				html.includes(`/assento/${example.recordId}`),
				"Web search omitted known record",
			);
		}
		const record = await api.record(example.recordId);
		requireCheck(record.status === "published", "Record is not published");
		await get(manifest.webUrl, `/assento/${example.recordId}`);
		requireCheck(Boolean(record.book.recordUrl && record.book.viewerUrl), "Missing source links");
		for (const url of [record.book.recordUrl, record.book.viewerUrl]) if (url) await get(url, "");
		evidence.push(
			`known record ${example.recordId}: search, combined filters, detail, source links`,
		);
	}
	return {
		checkedAt: new Date().toISOString(),
		commit: manifest.commit,
		webUrl: manifest.webUrl,
		apiUrl: manifest.apiUrl,
		evidence,
		remaining: [
			"Desktop/mobile visual inspection",
			"Source timeout/5xx drill in isolated environment",
			"Authorized editorial review/publication",
			"Confirm #91 integration",
		],
	};
}
