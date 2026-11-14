import { createHash } from "node:crypto";
import {
	type BatchPage,
	extractionBatchSchema,
	type HistoricalStoredEntry,
	historicalStoredEntrySchema,
	type ProposedSeat,
	proposedSeatSchema,
} from "@hdata/domain";
import type { Pool } from "pg";
import { type ImageLoader, type ModelProvider, TransientExtractionError } from "./provider.ts";
import { type ExtractionRun, processExtraction, requestExtraction } from "./service.ts";

export type CoveragePage = BatchPage & {
	status: "blocked" | "budget" | "reused" | ExtractionRun["status"];
	runId: string | null;
	attempts: number;
	failure: string | null;
};
export type BatchIndexEntry = {
	pageKey: string;
	imageId: string;
	sourceId: string;
	proposalId: string;
	model: string;
	modelVersion: string;
	promptVersion: string;
	imageSha256: string | null;
	confidence: number;
	confidenceKind: "estimate";
	reviewStatus: string;
	revisionId: string | null;
	content: ProposedSeat;
};

export function previewBatch(input: unknown): CoveragePage[] {
	return extractionBatchSchema.parse(input).pages.map((page) => ({
		...page,
		status: "blocked",
		runId: null,
		attempts: 0,
		failure: blockReason(page) ?? "not_executed",
	}));
}
function blockReason(page: BatchPage): string | null {
	if (!page.available) return page.reason ?? "content_unavailable";
	if (!page.authorized || !page.rightsEvidence) return "reuse_not_authorized";
	if (!page.imageId || !page.document || !page.page) return "page_not_identified";
	return null;
}

/** Caller holds the batch advisory lock (CLI). Only proposals are created; no archive edits. */
export async function runExtractionBatch(
	pool: Pool,
	input: unknown,
	deps: { provider: ModelProvider; loadImage: ImageLoader },
) {
	const batch = extractionBatchSchema.parse(input);
	const maxCalls = Math.min(
		batch.maxTotalAttempts,
		Math.floor(batch.maxCostMicrousd / batch.attemptCostCeilingMicrousd),
	);
	const manifestHash = createHash("sha256")
		.update(
			JSON.stringify({
				batch,
				model: [deps.provider.model, deps.provider.version, deps.provider.promptVersion],
			}),
		)
		.digest("hex");
	await pool.query(
		`INSERT INTO extraction_batch_budget (id,manifest_hash,max_calls) VALUES ($1,$2,$3)
		 ON CONFLICT (id) DO NOTHING`,
		[batch.id, manifestHash, maxCalls],
	);
	const budget = await pool.query<{ manifest_hash: string }>(
		"SELECT manifest_hash FROM extraction_batch_budget WHERE id=$1",
		[batch.id],
	);
	if (budget.rows[0]?.manifest_hash !== manifestHash)
		throw new Error("Batch identity already exists with a different manifest or model");
	const pages = previewBatch(batch);
	const historical = await pool.query<{ payload: unknown }>(
		"SELECT payload FROM historical_entry ORDER BY created_at,id",
	);
	const historicalEntries = historical.rows.map((row) =>
		historicalStoredEntrySchema.parse(row.payload),
	);
	const reusedHistory: { pageKey: string; original: HistoricalStoredEntry }[] = [];
	const reusedRevisions: {
		pageKey: string;
		revisionId: string;
		originalText: string;
		status: string;
		sourceId: string;
		locator: string | null;
	}[] = [];
	// Priority is deterministic: representative deaths first; caller chooses the sample in manifest.
	const ordered = [...pages].sort(
		(a, b) => Number(b.recordType === "death") - Number(a.recordType === "death"),
	);
	let cursor = 0;
	async function next() {
		for (;;) {
			const page = ordered[cursor++];
			if (!page) return;
			if (blockReason(page)) continue;
			const imageId = page.imageId;
			if (!imageId) continue;
			const locator = await pool.query<{
				document: string;
				sequence: number;
				folio: string | null;
				external_id: string | null;
			}>(
				`SELECT COALESCE(b.reference_code,b.title) AS document,i.sequence,i.folio,i.external_id
				 FROM image_ref i JOIN book b ON b.id=i.book_id WHERE i.id=$1`,
				[imageId],
			);
			const identified = locator.rows[0];
			if (
				!identified ||
				identified.document !== page.document ||
				![String(identified.sequence), identified.folio, identified.external_id].includes(page.page)
			) {
				page.failure = "image_locator_mismatch";
				continue;
			}
			// Only exact book + page links are reused; an index remains an index.
			const matched = historicalEntries.filter(
				(h) => h.entry.bookReference === page.document && h.entry.locator === page.page,
			);
			for (const original of matched) reusedHistory.push({ pageKey: page.key, original });
			if (matched.some((h) => h.entry.kind === "transcription" && h.entry.text)) {
				page.status = "reused";
				page.failure = null;
				continue;
			}
			// Reuse linked human transcriptions; never replace them with automatic readings.
			const existing = await pool.query<{
				revision_id: string;
				original_text: string;
				status: string;
				source_id: string;
				locator: string | null;
			}>(
				`SELECT ri.revision_id,r.original_text,r.status,r.source_id,r.locator FROM record_revision_image ri JOIN record_revision r ON r.id=ri.revision_id
				 WHERE ri.image_id=$1 AND r.original_text IS NOT NULL ORDER BY r.revision_number`,
				[imageId],
			);
			if (existing.rows.length) {
				for (const row of existing.rows)
					reusedRevisions.push({
						pageKey: page.key,
						revisionId: row.revision_id,
						originalText: row.original_text,
						status: row.status,
						sourceId: row.source_id,
						locator: row.locator,
					});
				page.status = "reused";
				page.failure = null;
				continue;
			}
			let run = await requestExtraction(pool, {
				imageId,
				provider: deps.provider,
				maxAttempts: batch.maxAttempts,
			});
			page.runId = run.id;
			for (;;) {
				if (run.status === "succeeded" || run.status === "failed") break;
				// Do not charge a live worker; expired runs can be reclaimed by processExtraction.
				if (run.status === "running") {
					const live = await pool.query(
						"SELECT id FROM extraction_run WHERE id=$1 AND lease_until>=now()",
						[run.id],
					);
					if (live.rows.length) break;
				}
				// Reserve BEFORE I/O. Crashes can waste a reservation but cannot overspend it.
				const reserved = await pool.query(
					`UPDATE extraction_batch_budget SET reserved_calls=reserved_calls+1
					 WHERE id=$1 AND reserved_calls<max_calls RETURNING reserved_calls`,
					[batch.id],
				);
				if (!reserved.rows.length) {
					page.status = "budget";
					page.failure = "attempt_budget_exhausted";
					break;
				}
				try {
					run = await processExtraction(pool, run.id, deps);
				} catch (error) {
					if (!(error instanceof TransientExtractionError)) throw error;
					// Leave the transient failure durable for the next invocation; no tight retry loop.
					page.failure = `${error.code}: ${error.message}`;
					break;
				}
				break;
			}
			const current = await pool.query<{
				status: ExtractionRun["status"];
				attempts: number;
				error_code: string | null;
				error_message: string | null;
			}>("SELECT status,attempts,error_code,error_message FROM extraction_run WHERE id=$1", [
				run.id,
			]);
			const row = current.rows[0];
			if (!row) throw new Error("Extraction disappeared");
			page.attempts = row.attempts;
			if (page.status !== "budget") {
				page.status = row.status;
				page.failure = row.error_code ? `${row.error_code}: ${row.error_message}` : null;
			}
		}
	}
	// Await every worker even if one fails, so resources are not closed under in-flight writes.
	const workers = await Promise.allSettled(Array.from({ length: batch.concurrency }, next));
	for (const worker of workers) if (worker.status === "rejected") throw worker.reason;
	const index: BatchIndexEntry[] = [];
	for (const page of pages) {
		if (!page.imageId || blockReason(page) || page.status === "blocked") continue;
		const proposals = await pool.query<{
			id: string;
			source_id: string;
			model: string;
			model_version: string;
			prompt_version: string;
			image_sha256: string | null;
			confidence: number;
			review_status: string;
			revision_id: string | null;
			content: unknown;
		}>(
			`SELECT p.*,r.source_id,r.model,r.model_version,r.prompt_version,r.image_sha256
			 FROM extraction_proposal p JOIN extraction_run r ON r.id=p.run_id
			 WHERE r.image_id=$1 ORDER BY r.created_at,p.ordinal`,
			[page.imageId],
		);
		for (const p of proposals.rows)
			index.push({
				pageKey: page.key,
				imageId: page.imageId,
				sourceId: p.source_id,
				proposalId: p.id,
				model: p.model,
				modelVersion: p.model_version,
				promptVersion: p.prompt_version,
				imageSha256: p.image_sha256,
				confidence: p.confidence,
				confidenceKind: "estimate",
				reviewStatus: p.review_status,
				revisionId: p.revision_id,
				content: proposedSeatSchema.parse(p.content),
			});
	}
	const reservations = await pool.query<{ reserved_calls: number }>(
		"SELECT reserved_calls FROM extraction_batch_budget WHERE id=$1",
		[batch.id],
	);
	return {
		batchId: batch.id,
		pages,
		reusedHistory,
		reusedRevisions,
		index,
		reviewQueue: index.filter((p) => p.reviewStatus === "pending"),
		reservedCalls: reservations.rows[0]?.reserved_calls,
		maxCalls,
		maxCostMicrousd: batch.maxCostMicrousd,
		reservedCostMicrousd:
			(reservations.rows[0]?.reserved_calls ?? 0) * batch.attemptCostCeilingMicrousd,
	};
}
