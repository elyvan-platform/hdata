import { PGlite } from "@electric-sql/pglite";
import type { ProposedSeat } from "@hdata/domain";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Pool } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";
import { evaluatePilot } from "./evaluate.ts";
import {
	createAnthropicProvider,
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
		"INSERT INTO source (name,kind) VALUES ('Arquivo','primary') RETURNING id",
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
		"INSERT INTO image_ref (source_id,book_id,sequence,url) VALUES ($1,$2,1,'https://example.org/i.jpg') RETURNING id",
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
	const model = createAnthropicProvider({
		apiKey: "k",
		model: "m",
		timeoutMs: 1000,
		fetch: async () => new Response("{}", { status: 503 }),
	});
	await expect(
		model.extract({ bytes: new Uint8Array([1]), mediaType: "image/jpeg", sha256: "a" }),
	).rejects.toBeInstanceOf(TransientExtractionError);
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
