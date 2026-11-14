import { describe, expect, it } from "vitest";
import { runSmoke, smokeManifestSchema } from "./smoke.ts";

const manifest = {
	webUrl: "https://web.example",
	apiUrl: "https://api.example",
	commit: "abc123",
	books: 39,
	viewers: 27,
	publishedRecords: 1,
	publishedPages: 1,
	examples: [
		{
			recordId: "f8ec7c76-40af-4edf-8ee3-7b21ab141ac9",
			query: { q: "known name", type: "baptism", book: "reference", from: 1800, to: 1900 },
		},
	],
};

describe("post-deploy smoke guard", () => {
	it("refuses zero counts and absent evidence before network access", () => {
		expect(
			smokeManifestSchema.safeParse({ ...manifest, books: 0, publishedRecords: 0 }).success,
		).toBe(false);
		expect(smokeManifestSchema.safeParse({ ...manifest, examples: [] }).success).toBe(false);
	});
	it("rejects unknown versions", () => {
		expect(smokeManifestSchema.safeParse({ ...manifest, commit: "unknown" }).success).toBe(false);
	});
	it("fails on an unhealthy deployment", async () => {
		await expect(
			runSmoke(manifest, async () => new Response("down", { status: 503 })),
		).rejects.toThrow("HTTP 503");
	});
	it("rejects an HTML success response masquerading as an asset", async () => {
		await expect(
			runSmoke(manifest, async (url) => {
				if (String(url).endsWith("/version")) return Response.json({ commit: "abc123" });
				return new Response("<html>fallback</html>", { headers: { "content-type": "text/html" } });
			}),
		).rejects.toThrow("expected PNG");
	});
});

const record = {
	recordId: manifest.examples[0]?.recordId,
	recordType: "baptism",
	status: "published",
	date: null,
	place: null,
	folio: null,
	locator: null,
	participants: [],
	images: [],
	origin: { sourceName: "Test source", sourceKind: "archive", citation: null, method: "manual" },
	book: {
		referenceCode: "reference",
		title: "Test book",
		recordUrl: "https://source.example/details",
		viewerUrl: "https://source.example/viewer",
	},
};

function deploymentFetch(options: { records?: number; sourceStatus?: number } = {}): typeof fetch {
	return async (input) => {
		const url = new URL(String(input));
		if (url.pathname === "/version") return Response.json({ commit: manifest.commit });
		if (url.pathname.endsWith(".png"))
			return new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...Array(32).fill(0)]), {
				headers: { "content-type": "image/png" },
			});
		if (url.pathname === "/catalog")
			return Response.json({
				status: {
					data: "fresh",
					lastAttempt: null,
					lastSuccessAt: "2026-11-14T00:00:00Z",
					reconciliation: null,
				},
				books: Array.from({ length: 39 }, (_, index) => ({
					referenceCode: `book-${index}`,
					title: "Test book",
					...(index < 27 ? { viewerUrl: "https://source.example/viewer" } : {}),
				})),
			});
		if (url.pathname === "/search/coverage")
			return Response.json({
				publishedRecords: options.records ?? 1,
				publishedPages: 1,
				books: [],
			});
		if (url.pathname === "/search")
			return Response.json({ total: 1, page: 1, pageSize: 20, results: [record] });
		if (url.pathname.startsWith("/records/")) return Response.json(record);
		if (url.hostname === "source.example")
			return new Response("source", { status: options.sourceStatus ?? 200 });
		return new Response(
			`<link rel="icon" href="/brand/memoria-de-caiz-icone.png"><a href="/assento/${record.recordId}">Record</a>`,
		);
	};
}

it("records checked counts and known-record evidence without claiming release approval", async () => {
	const result = await runSmoke(manifest, deploymentFetch());
	expect(result.commit).toBe(manifest.commit);
	expect(result.evidence.some((line) => line.includes("records=1"))).toBe(true);
	expect(result.remaining).toContain("Authorized editorial review/publication");
});

it("fails a deployment with zero actual records despite positive expected counts", async () => {
	await expect(runSmoke(manifest, deploymentFetch({ records: 0 }))).rejects.toThrow(
		"Published record count mismatch",
	);
});

it("does not hide a source failure", async () => {
	await expect(runSmoke(manifest, deploymentFetch({ sourceStatus: 503 }))).rejects.toThrow(
		"HTTP 503",
	);
});
