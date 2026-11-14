import { PGlite } from "@electric-sql/pglite";
import type { ProposedSeat } from "@hdata/domain";
import { extractionBatchSchema } from "@hdata/domain";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Pool } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";
import { previewBatch, runExtractionBatch } from "./batch.ts";
import { evaluatePilot } from "./evaluate.ts";
import {
	createOpenRouterProvider,
	createUrlImageLoader,
	type ImageLoader,
	type ModelProvider,
	TransientExtractionError,
} from "./provider.ts";
import { processExtraction, requestExtraction, reviewProposal } from "./service.ts";

let db: PGlite;
let pool: Pool;
let imageId: string;

const f = <T>(value: T, confidence = 0.9) => ({ value, confidence });
const seat = (text: string, confidence = 0.9): ProposedSeat => ({
	recordType: f("baptism" as const, confidence),
	originalText: f(text, confidence),
	folio: f(null),
	placeAsWritten: f("Vila Caiz"),
	dateAsWritten: f(null),
	marginalNotes: f(null),
	participants: [
		{
			participant: { role: "child", nameAsWritten: "Joana", legibility: "legible", position: 0 },
			confidence: 0.8,
		},
	],
	region: { x: 0.1, y: 0.1, w: 0.8, h: 0.4 },
});
const loadImage: ImageLoader = async () => ({
	bytes: new Uint8Array([1]),
	mediaType: "image/jpeg",
	sha256: "abc",
});
function provider(
	extract: ModelProvider["extract"],
	version = "v1",
): ModelProvider & { calls: number } {
	const p = {
		model: "test",
		version,
		promptVersion: "p1",
		calls: 0,
		extract: async (image: Parameters<ModelProvider["extract"]>[0]) => {
			p.calls++;
			return extract(image);
		},
	};
	return p;
}

beforeAll(async () => {
	db = await PGlite.create();
	await migrate(drizzle(db), { migrationsFolder: "./drizzle" });
	pool = {
		connect: async () => ({
			query: (q: string, p?: unknown[]) => db.query(q, p),
			release: () => {},
		}),
		query: (q: string, p?: unknown[]) => db.query(q, p),
	} as unknown as Pool;
	const one = async (q: string, p: unknown[] = []) =>
		(await db.query<{ id: string }>(q, p)).rows[0]?.id ?? "";
	const source = await one(
		"INSERT INTO source (name,kind,rights_status) VALUES ('Arquivo','primary','authorized') RETURNING id",
	);
	const unit = await one(
		"INSERT INTO archival_unit (source_id,level,title) VALUES ($1,'fonds','F') RETURNING id",
		[source],
	);
	const book = await one(
		"INSERT INTO book (source_id,archival_unit_id,title) VALUES ($1,$2,'L') RETURNING id",
		[source, unit],
	);
	imageId = await one(
		"INSERT INTO image_ref (source_id,book_id,sequence,url,rights_status) VALUES ($1,$2,1,'https://example.org/i.jpg','authorized') RETURNING id",
		[source, book],
	);
});
afterAll(() => db.close());

it("stores proposals once per image, model and version, and reruns are no-ops", async () => {
	const p = provider(async () => ({ seats: [seat("Aos dez dias [ilegível]"), seat("Aos onze")] }));
	const run = await requestExtraction(pool, { imageId, provider: p });
	expect((await requestExtraction(pool, { imageId, provider: p })).id).toBe(run.id);
	expect((await processExtraction(pool, run.id, { provider: p, loadImage })).status).toBe(
		"succeeded",
	);
	await processExtraction(pool, run.id, { provider: p, loadImage });
	expect(p.calls).toBe(1);
	const rows = await db.query<{
		confidence: number;
		confidence_kind: string;
		has_illegible: boolean;
	}>(
		"SELECT confidence,confidence_kind,has_illegible FROM extraction_proposal WHERE run_id=$1 ORDER BY ordinal",
		[run.id],
	);
	expect(
		rows.rows.map((r) => [r.confidence.toFixed(1), r.confidence_kind, r.has_illegible]),
	).toEqual([
		["0.8", "estimate", true],
		["0.8", "estimate", false],
	]);
	const stored = await db.query<{ model: string; model_version: string; image_sha256: string }>(
		"SELECT model,model_version,image_sha256 FROM extraction_run WHERE id=$1",
		[run.id],
	);
	expect(stored.rows[0]).toEqual({ model: "test", model_version: "v1", image_sha256: "abc" });
	const newer = await requestExtraction(pool, {
		imageId,
		provider: provider(async () => ({}), "v2"),
	});
	expect(newer.id).not.toBe(run.id);
});

it("limits attempts on transient errors and records the failure", async () => {
	const p = provider(async () => {
		throw new TransientExtractionError("model_http_error", "503");
	}, "flaky");
	const run = await requestExtraction(pool, { imageId, provider: p, maxAttempts: 2 });
	await expect(processExtraction(pool, run.id, { provider: p, loadImage })).rejects.toThrow("503");
	const mid = await db.query<{ status: string }>("SELECT status FROM extraction_run WHERE id=$1", [
		run.id,
	]);
	expect(mid.rows[0]?.status).toBe("queued");
	await expect(processExtraction(pool, run.id, { provider: p, loadImage })).rejects.toThrow("503");
	const after = await processExtraction(pool, run.id, { provider: p, loadImage });
	expect(after.status).toBe("failed");
	expect(p.calls).toBe(2);
	const row = await db.query<{ error_code: string; attempts: number }>(
		"SELECT error_code,attempts FROM extraction_run WHERE id=$1",
		[run.id],
	);
	expect(row.rows[0]).toEqual({ error_code: "model_http_error", attempts: 2 });
});

it("fails permanently on malformed model output without writing proposals", async () => {
	const p = provider(async () => ({ seats: [{ originalText: "x" }] }), "bad");
	const run = await requestExtraction(pool, { imageId, provider: p });
	expect((await processExtraction(pool, run.id, { provider: p, loadImage })).status).toBe("failed");
	const count = await db.query("SELECT 1 FROM extraction_proposal WHERE run_id=$1", [run.id]);
	expect(count.rows).toHaveLength(0);
});

it("turns a proposal into a draft revision only when a human accepts it", async () => {
	const p = provider(async () => ({ seats: [seat("Aos doze")] }), "review");
	const run = await requestExtraction(pool, { imageId, provider: p });
	await processExtraction(pool, run.id, { provider: p, loadImage });
	expect((await db.query("SELECT 1 FROM archive_record")).rows).toHaveLength(0);
	const proposal = (
		await db.query<{ id: string }>("SELECT id FROM extraction_proposal WHERE run_id=$1", [run.id])
	).rows[0]?.id as string;
	await expect(
		reviewProposal(pool, {
			proposalId: proposal,
			decision: "accept",
			actor: { id: "p", role: "publisher" },
		}),
	).rejects.toMatchObject({ code: "forbidden" });
	const { revisionId } = await reviewProposal(pool, {
		proposalId: proposal,
		decision: "accept",
		actor: { id: "ed", role: "editor" },
	});
	const rev = await db.query<{ status: string; original_text: string }>(
		"SELECT status,original_text FROM record_revision WHERE id=$1",
		[revisionId],
	);
	expect(rev.rows[0]).toEqual({ status: "draft", original_text: "Aos doze" });
	await expect(
		reviewProposal(pool, {
			proposalId: proposal,
			decision: "reject",
			actor: { id: "ed", role: "editor" },
		}),
	).rejects.toMatchObject({ code: "already_reviewed" });
});

it("loads images and calls the model API with traceable failures", async () => {
	const ok = createUrlImageLoader({
		timeoutMs: 1000,
		fetch: async () =>
			new Response(new Uint8Array([1, 2]), { headers: { "content-type": "image/jpeg" } }),
	});
	expect((await ok({ url: "https://x/y.jpg", storageKey: null })).mediaType).toBe("image/jpeg");
	const html = createUrlImageLoader({
		timeoutMs: 1000,
		fetch: async () => new Response("<html>", { headers: { "content-type": "text/html" } }),
	});
	await expect(html({ url: "https://x", storageKey: null })).rejects.toMatchObject({
		code: "image_type",
	});
	const model = createOpenRouterProvider({
		apiKey: "k",
		model: "m",
		timeoutMs: 1000,
		fetch: async () => new Response("{}", { status: 503 }),
	});
	await expect(
		model.extract({ bytes: new Uint8Array([1]), mediaType: "image/jpeg", sha256: "a" }),
	).rejects.toBeInstanceOf(TransientExtractionError);
});

it("sends images to OpenRouter and validates its response", async () => {
	const image = { bytes: new Uint8Array([1, 2]), mediaType: "image/jpeg", sha256: "a" };
	const model = createOpenRouterProvider({
		apiKey: "secret",
		model: "google/gemini-2.5-flash",
		timeoutMs: 1000,
		fetch: async (url, init) => {
			expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
			expect(init?.headers).toMatchObject({ authorization: "Bearer secret" });
			const request = JSON.parse(String(init?.body));
			expect(request.model).toBe("google/gemini-2.5-flash");
			expect(request.messages[1].content[1]).toEqual({
				type: "image_url",
				image_url: { url: "data:image/jpeg;base64,AQI=" },
			});
			return Response.json({ choices: [{ message: { content: '{"seats":[]}' } }] });
		},
	});
	expect(model.model).toBe("openrouter");
	await expect(model.extract(image)).resolves.toEqual({ seats: [] });
	const invalid = createOpenRouterProvider({
		apiKey: "secret",
		model: "m",
		timeoutMs: 1000,
		fetch: async () => Response.json({ choices: [] }),
	});
	await expect(invalid.extract(image)).rejects.toMatchObject({ code: "model_output" });
});

it("measures error rate against manually reviewed seats", () => {
	const metrics = evaluatePilot(
		[seat("Aos dez dias de Maio"), seat("texto espúrio sem relação nenhuma")],
		[
			{ originalText: "Aos dez dias de Mayo", recordType: "baptism" },
			{ originalText: "Aos vinte", recordType: "death" },
		],
	);
	expect(metrics.matchedSeats).toBe(1);
	expect(metrics.seatRecall).toBe(0.5);
	expect(metrics.seatPrecision).toBe(0.5);
	expect(metrics.characterErrorRate).toBeCloseTo(1 / 20);
	expect(metrics.recordTypeAccuracy).toBe(1);
});

const imagePages = new Map<string, string>();

async function batchImages(count: number) {
	const base = (
		await db.query<{ source_id: string; book_id: string }>(
			"SELECT source_id,book_id FROM image_ref WHERE id=$1",
			[imageId],
		)
	).rows[0];
	if (!base) throw new Error("Missing fixture");
	const images: string[] = [];
	for (let n = 0; n < count; n++) {
		const result = await db.query<{ id: string; sequence: number }>(
			`INSERT INTO image_ref (source_id,book_id,sequence,url,rights_status)
			 SELECT $1,$2,MAX(sequence)+1,'https://example.org/batch.jpg','authorized' FROM image_ref RETURNING id,sequence`,
			[base.source_id, base.book_id],
		);
		const id = result.rows[0]?.id;
		if (!id) throw new Error("Missing image");
		imagePages.set(id, String(result.rows[0]?.sequence));
		images.push(id);
	}
	return images;
}
function manifest(id: string, images: string[], calls = 10) {
	return {
		id,
		concurrency: 2,
		maxAttempts: 2,
		maxTotalAttempts: calls,
		maxCostMicrousd: calls * 100,
		attemptCostCeilingMicrousd: 100,
		pages: images.map((imageId, n) => ({
			key: `${id}:${n}`,
			source: "Synthetic archive",
			recordType: "death",
			document: "L",
			page: imagePages.get(imageId) ?? "missing",
			imageId,
			available: true,
			authorized: true,
			rightsEvidence: "Synthetic fixture permits external processing",
			reason: null,
		})),
	};
}

it("processes a death batch with bounded concurrency and durable budget; reruns preserve review", async () => {
	const images = await batchImages(3);
	const input = manifest("batch-success", images, 2);
	let active = 0;
	let peak = 0;
	const p = provider(async () => {
		active++;
		peak = Math.max(peak, active);
		await new Promise((resolve) => setTimeout(resolve, 5));
		active--;
		return { seats: [{ ...seat("Aos vinte faleceu Maria"), recordType: f("death") }] };
	}, "batch");
	const first = await runExtractionBatch(pool, input, { provider: p, loadImage });
	expect(first.index).toHaveLength(2);
	expect(first.reviewQueue).toHaveLength(2);
	expect(first.pages.filter((p) => p.status === "budget")).toHaveLength(1);
	expect(first.reservedCalls).toBe(2);
	expect(peak).toBeLessThanOrEqual(2);
	const proposalId = first.index[0]?.proposalId;
	if (!proposalId) throw new Error("Missing proposal");
	await reviewProposal(pool, {
		proposalId,
		decision: "accept",
		actor: { id: "human-editor", role: "editor" },
	});
	const again = await runExtractionBatch(pool, input, { provider: p, loadImage });
	expect(p.calls).toBe(2);
	expect(again.reservedCalls).toBe(2);
	expect(again.reviewQueue).toHaveLength(1);
	expect(again.index.find((p) => p.proposalId === proposalId)?.reviewStatus).toBe("accepted");
	await expect(
		runExtractionBatch(pool, { ...input, maxTotalAttempts: 3 }, { provider: p, loadImage }),
	).rejects.toThrow("different manifest");
});

it("resumes transient failures and never resets the budget or attempt limit", async () => {
	const input = manifest("batch-retry", await batchImages(1), 3);
	const p = provider(async () => {
		throw new TransientExtractionError("rate_limit", "429");
	}, "batch-retry");
	const first = await runExtractionBatch(pool, input, { provider: p, loadImage });
	expect(first.pages[0]?.status).toBe("queued");
	expect(first.pages[0]?.failure).toContain("rate_limit");
	const second = await runExtractionBatch(pool, input, { provider: p, loadImage });
	expect(second.pages[0]?.status).toBe("failed");
	await runExtractionBatch(pool, input, { provider: p, loadImage });
	expect(p.calls).toBe(2);
});

it("indexes unavailable metadata and blocks unknown rights without model calls", async () => {
	const input = manifest("batch-blocked", await batchImages(1));
	const page = input.pages[0];
	if (!page) throw new Error("Missing page");
	page.authorized = false;
	const p = provider(async () => ({ seats: [] }), "blocked");
	const result = await runExtractionBatch(pool, input, { provider: p, loadImage });
	expect(result.pages[0]?.failure).toBe("reuse_not_authorized");
	expect(result.reservedCalls).toBe(0);
	expect(p.calls).toBe(0);
	expect(
		previewBatch({
			...input,
			pages: [{ ...page, available: false, document: null, page: null, reason: "not enumerated" }],
		})[0],
	).toMatchObject({ document: null, page: null, failure: "not enumerated" });
	expect(extractionBatchSchema.safeParse({ ...input, pages: [page, page] }).success).toBe(false);
});

it("checks database rights even when a caller bypasses the batch manifest", async () => {
	const id = (await batchImages(1))[0];
	if (!id) throw new Error("Missing image");
	await db.query("UPDATE image_ref SET rights_status='unknown' WHERE id=$1", [id]);
	const p = provider(async () => ({ seats: [] }), "rights");
	const run = await requestExtraction(pool, { imageId: id, provider: p });
	expect((await processExtraction(pool, run.id, { provider: p, loadImage })).status).toBe("failed");
	expect(p.calls).toBe(0);
	expect(
		(
			await db.query<{ error_code: string }>("SELECT error_code FROM extraction_run WHERE id=$1", [
				run.id,
			])
		).rows[0]?.error_code,
	).toBe("rights_unknown");
});

it("reclaims expired attempts, fences late output and exhausts crashed final attempts", async () => {
	const id = (await batchImages(1))[0];
	if (!id) throw new Error("Missing image");
	const p = provider(async () => ({ seats: [seat("retomado")] }), "lease");
	const run = await requestExtraction(pool, { imageId: id, provider: p, maxAttempts: 2 });
	await db.query(
		"UPDATE extraction_run SET status='running',attempts=1,lease_until=now()-interval '1 second' WHERE id=$1",
		[run.id],
	);
	expect((await processExtraction(pool, run.id, { provider: p, loadImage })).status).toBe(
		"succeeded",
	);
	expect(p.calls).toBe(1);
	const late = provider(async () => {
		await db.query("UPDATE extraction_run SET attempts=2 WHERE id=$1", [lateRun.id]);
		return { seats: [seat("stale response")] };
	}, "late");
	const lateRun = await requestExtraction(pool, { imageId: id, provider: late, maxAttempts: 2 });
	await processExtraction(pool, lateRun.id, { provider: late, loadImage });
	expect(
		(await db.query("SELECT id FROM extraction_proposal WHERE run_id=$1", [lateRun.id])).rows,
	).toHaveLength(0);
	await db.query("UPDATE extraction_run SET lease_until=now()-interval '1 second' WHERE id=$1", [
		lateRun.id,
	]);
	expect((await processExtraction(pool, lateRun.id, { provider: late, loadImage })).status).toBe(
		"failed",
	);
});

it("reuses exact historical references without turning an index into a validated transcription", async () => {
	const images = await batchImages(2);
	const input = manifest("historical-reuse", images);
	const sourceId = (
		await db.query<{ source_id: string }>("SELECT source_id FROM image_ref WHERE id=$1", [
			images[0],
		])
	).rows[0]?.source_id;
	if (!sourceId) throw new Error("Missing source");
	for (const [n, kind] of ["transcription", "index"].entries()) {
		const payload = {
			sourceId,
			citation: "Synthetic historical export",
			reuseEvidence: "Fixture",
			entry: {
				externalId: `history-${n}`,
				kind,
				recordType: "death",
				bookReference: "L",
				locator: input.pages[n]?.page,
				text: "Leitura histórica",
				raw: {},
			},
		};
		await db.query(
			"INSERT INTO historical_entry (source_id,external_id,content_hash,payload) VALUES ($1,$2,$3,$4)",
			[sourceId, `history-${n}`, `hash-${n}`, JSON.stringify(payload)],
		);
	}
	const p = provider(
		async () => ({ seats: [{ ...seat("nova leitura"), recordType: f("death") }] }),
		"history",
	);
	const result = await runExtractionBatch(pool, input, { provider: p, loadImage });
	expect(result.pages[0]?.status).toBe("reused");
	expect(result.reusedHistory).toHaveLength(2);
	expect(result.index).toHaveLength(1);
	expect(p.calls).toBe(1);
});

it("enforces the monetary reservation ceiling even when the call cap is higher", async () => {
	const input = { ...manifest("cost-cap", await batchImages(2)), maxCostMicrousd: 100 };
	const p = provider(async () => ({ seats: [] }), "cost");
	const result = await runExtractionBatch(pool, input, { provider: p, loadImage });
	expect(p.calls).toBe(1);
	expect(result.reservedCostMicrousd).toBe(100);
	expect(result.pages.filter((p) => p.status === "budget")).toHaveLength(1);
});

it("prioritizes deaths and rejects image locators that do not match the catalog", async () => {
	const input = manifest("death-priority", await batchImages(2), 1);
	const first = input.pages[0];
	const second = input.pages[1];
	if (!first || !second) throw new Error("Missing pages");
	first.recordType = "baptism";
	input.concurrency = 1;
	const p = provider(async () => ({ seats: [] }), "priority");
	const result = await runExtractionBatch(pool, input, { provider: p, loadImage });
	expect(result.pages[0]?.status).toBe("budget");
	expect(result.pages[1]?.status).toBe("succeeded");
	const mismatched = manifest("wrong-locator", await batchImages(1));
	const wrong = mismatched.pages[0];
	if (!wrong) throw new Error("Missing page");
	wrong.document = "another book";
	const blocked = await runExtractionBatch(pool, mismatched, { provider: p, loadImage });
	expect(blocked.pages[0]?.failure).toBe("image_locator_mismatch");
	expect(blocked.reservedCalls).toBe(0);
	expect(p.calls).toBe(1);
});
