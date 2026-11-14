import { z } from "zod";
import { recordTypeSchema } from "./archive.ts";

/** A missing document/page is unknown coverage, never an invented page zero. */
export const batchPageSchema = z.object({
	key: z.string().min(1),
	source: z.string().min(1),
	metadata: z.record(z.string(), z.string()).default({}),
	recordType: recordTypeSchema,
	document: z.string().min(1).nullable(),
	page: z.string().min(1).nullable(),
	imageId: z.uuid().nullable(),
	available: z.boolean(),
	authorized: z.boolean(),
	// Evidence must explicitly cover external model processing, not just online viewing.
	rightsEvidence: z.string().min(1).nullable(),
	reason: z.string().min(1).nullable(),
});
export const extractionBatchSchema = z
	.object({
		id: z.string().min(1),
		concurrency: z.number().int().min(1).max(8),
		maxAttempts: z.number().int().min(1).max(10),
		// Lifetime cap for this manifest/model, including attempts made in previous invocations.
		maxTotalAttempts: z.number().int().nonnegative().max(1_000_000),
		maxCostMicrousd: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
		attemptCostCeilingMicrousd: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
		pages: z.array(batchPageSchema),
	})
	.superRefine((batch, ctx) => {
		for (const field of ["key", "imageId"] as const) {
			const values = batch.pages.map((p) => p[field]).filter((v) => v !== null);
			if (new Set(values).size !== values.length)
				ctx.addIssue({ code: "custom", message: `Duplicate ${field}` });
		}
	});
export type ExtractionBatch = z.infer<typeof extractionBatchSchema>;
export type BatchPage = z.infer<typeof batchPageSchema>;
