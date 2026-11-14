import { createHash } from "node:crypto";
import {
	can,
	type EditorialRole,
	hasIllegible,
	modelOutputSchema,
	type ProposedSeat,
	proposedSeatSchema,
	seatConfidence,
} from "@hdata/domain";
import type { Pool } from "pg";
import { importRecord } from "../archive/import-record.ts";
import {
	type ImageLoader,
	type ModelProvider,
	PermanentExtractionError,
	TransientExtractionError,
} from "./provider.ts";

export const defaultMaxAttempts = 3;

export type ExtractionRun = {
	id: string;
	status: "queued" | "running" | "succeeded" | "failed";
	attempts: number;
	maxAttempts: number;
};

export function idempotencyKey(imageId: string, provider: ModelProvider): string {
	return createHash("sha256")
		.update([imageId, provider.model, provider.version, provider.promptVersion].join("\n"))
		.digest("hex");
}

/** Creates the run for image + model + version + prompt, or returns the existing one. */
export async function requestExtraction(
	pool: Pool,
	input: { imageId: string; provider: ModelProvider; maxAttempts?: number },
): Promise<ExtractionRun> {
	const image = await pool.query<{ source_id: string }>(
		"SELECT source_id FROM image_ref WHERE id=$1",
		[input.imageId],
	);
	const sourceId = image.rows[0]?.source_id;
	if (!sourceId) throw new Error(`Image ${input.imageId} does not exist`);
	await pool.query(
		`INSERT INTO extraction_run (idempotency_key,image_id,source_id,model,model_version,prompt_version,max_attempts)
		 VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (idempotency_key) DO NOTHING`,
		[
			idempotencyKey(input.imageId, input.provider),
			input.imageId,
			sourceId,
			input.provider.model,
			input.provider.version,
			input.provider.promptVersion,
			input.maxAttempts ?? defaultMaxAttempts,
		],
	);
	const run = await pool.query<{
		id: string;
		status: ExtractionRun["status"];
		attempts: number;
		max_attempts: number;
	}>("SELECT id,status,attempts,max_attempts FROM extraction_run WHERE idempotency_key=$1", [
		idempotencyKey(input.imageId, input.provider),
	]);
	const row = run.rows[0];
	if (!row) throw new Error("Extraction run insertion returned no row");
	return { id: row.id, status: row.status, attempts: row.attempts, maxAttempts: row.max_attempts };
}

/**
 * Runs one attempt. A succeeded run is returned untouched (idempotent). A transient failure leaves
 * the run `queued` and rethrows so the queue retries; the last attempt, or any permanent failure,
 * ends `failed` with a traceable code and message. Never resolves a failure as an empty result.
 */
export async function processExtraction(
	pool: Pool,
	runId: string,
	deps: { provider: ModelProvider; loadImage: ImageLoader },
): Promise<ExtractionRun> {
	const claimed = await pool.query<{
		image_id: string;
		url: string | null;
		storage_key: string | null;
		attempts: number;
		max_attempts: number;
	}>(
		`UPDATE extraction_run r SET status='running', attempts=attempts+1
		 FROM image_ref i
		 WHERE r.id=$1 AND i.id=r.image_id AND r.status='queued' AND r.attempts<r.max_attempts
		 RETURNING r.image_id, i.url, i.storage_key, r.attempts, r.max_attempts`,
		[runId],
	);
	const claim = claimed.rows[0];
	if (!claim) {
		const current = await pool.query<{
			status: ExtractionRun["status"];
			attempts: number;
			max_attempts: number;
		}>("SELECT status,attempts,max_attempts FROM extraction_run WHERE id=$1", [runId]);
		const row = current.rows[0];
		if (!row) throw new Error(`Extraction run ${runId} does not exist`);
		return { id: runId, status: row.status, attempts: row.attempts, maxAttempts: row.max_attempts };
	}
	let imageSha: string | null = null;
	try {
		const image = await deps.loadImage({ url: claim.url, storageKey: claim.storage_key });
		imageSha = image.sha256;
		const parsed = modelOutputSchema.safeParse(await deps.provider.extract(image));
		if (!parsed.success)
			throw new PermanentExtractionError(
				"model_output",
				parsed.error.issues[0]?.message ?? "invalid",
			);
		await storeProposals(pool, runId, image.sha256, parsed.data.seats);
		return {
			id: runId,
			status: "succeeded",
			attempts: claim.attempts,
			maxAttempts: claim.max_attempts,
		};
	} catch (error) {
		const permanent = !(error instanceof TransientExtractionError);
		const exhausted = claim.attempts >= claim.max_attempts;
		const code =
			error instanceof PermanentExtractionError || error instanceof TransientExtractionError
				? error.code
				: "unexpected";
		const final = permanent || exhausted;
		await pool.query(
			`UPDATE extraction_run SET status=$2, error_code=$3, error_message=$4, image_sha256=COALESCE($5,image_sha256),
			 finished_at=CASE WHEN $2='failed' THEN now() END WHERE id=$1`,
			[
				runId,
				final ? "failed" : "queued",
				code,
				String(error instanceof Error ? error.message : error).slice(0, 500),
				imageSha,
			],
		);
		if (final && permanent)
			return {
				id: runId,
				status: "failed",
				attempts: claim.attempts,
				maxAttempts: claim.max_attempts,
			};
		throw error;
	}
}

async function storeProposals(pool: Pool, runId: string, imageSha: string, seats: ProposedSeat[]) {
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		for (const [ordinal, seat] of seats.entries()) {
			await client.query(
				`INSERT INTO extraction_proposal (run_id,ordinal,region,content,confidence,has_illegible)
				 VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (run_id,ordinal) DO NOTHING`,
				[
					runId,
					ordinal,
					seat.region ? JSON.stringify(seat.region) : null,
					JSON.stringify(seat),
					seatConfidence(seat),
					hasIllegible(seat),
				],
			);
		}
		await client.query(
			"UPDATE extraction_run SET status='succeeded', image_sha256=$2, error_code=NULL, error_message=NULL, finished_at=now() WHERE id=$1",
			[runId, imageSha],
		);
		await client.query("COMMIT");
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
}

export class ProposalReviewError extends Error {
	readonly code: "forbidden" | "not_found" | "already_reviewed" | "rights_unknown";
	constructor(code: ProposalReviewError["code"], message: string) {
		super(message);
		this.name = "ProposalReviewError";
		this.code = code;
	}
}

/**
 * The only way a proposal becomes archive data: a human with edit rights accepts it, which creates
 * a `draft` revision that still has to pass the editorial flow (submit, validate, publish).
 */
export async function reviewProposal(
	pool: Pool,
	input: {
		proposalId: string;
		decision: "accept" | "reject";
		actor: { id: string; role: EditorialRole };
	},
): Promise<{ revisionId: string | null }> {
	if (!can(input.actor.role, "edit"))
		throw new ProposalReviewError("forbidden", "Role cannot review proposals");
	const found = await pool.query<{
		content: unknown;
		review_status: string;
		run_id: string;
		ordinal: number;
		image_id: string;
		book_id: string;
		source_id: string;
		model: string;
		model_version: string;
	}>(
		`SELECT p.content,p.review_status,p.run_id,p.ordinal,r.image_id,i.book_id,r.source_id,r.model,r.model_version
		 FROM extraction_proposal p JOIN extraction_run r ON r.id=p.run_id JOIN image_ref i ON i.id=r.image_id
		 WHERE p.id=$1`,
		[input.proposalId],
	);
	const row = found.rows[0];
	if (!row) throw new ProposalReviewError("not_found", "Proposal does not exist");
	if (row.review_status !== "pending")
		throw new ProposalReviewError("already_reviewed", `Proposal is already ${row.review_status}`);
	let revisionId: string | null = null;
	if (input.decision === "accept") {
		const seat = proposedSeatSchema.parse(row.content);
		// Idempotent on (run, ordinal): a retry after a failed mark reuses the same draft.
		const imported = await importRecord(pool, {
			sourceId: row.source_id,
			externalId: `extraction:${row.run_id}:${row.ordinal}`,
			bookId: row.book_id,
			revision: {
				recordType: seat.recordType.value,
				folio: seat.folio.value ?? undefined,
				placeAsWritten: seat.placeAsWritten.value ?? undefined,
				originalText: seat.originalText.value,
				marginalNotes: seat.marginalNotes.value ?? undefined,
				participants: seat.participants.map((p) => p.participant),
				images: [{ imageId: row.image_id, ...(seat.region && { region: seat.region }) }],
				provenance: {
					sourceId: row.source_id,
					method: "import",
					locator: `${row.model}/${row.model_version} proposal ${input.proposalId}`,
					recordedBy: input.actor.id,
				},
			},
		});
		revisionId = imported.revisionId;
	}
	const marked = await pool.query(
		`UPDATE extraction_proposal SET review_status=$2, reviewed_by=$3, reviewed_at=now(), revision_id=$4
		 WHERE id=$1 AND review_status='pending'`,
		[
			input.proposalId,
			input.decision === "accept" ? "accepted" : "rejected",
			input.actor.id,
			revisionId,
		],
	);
	if (marked.rowCount === 0)
		throw new ProposalReviewError("already_reviewed", "Proposal was reviewed concurrently");
	return { revisionId };
}
