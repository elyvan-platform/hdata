import { z } from "zod";

/** Historical baseline the official catalog is reconciled against (task 04). */
export const catalogBaselineSchema = z.object({
	books: z.number().int().nonnegative(),
	viewers: z.number().int().nonnegative(),
});
export type CatalogBaseline = z.infer<typeof catalogBaselineSchema>;
export const knownCatalogBaseline: CatalogBaseline = { books: 39, viewers: 27 };

/** One book of the fonds as published by the catalog, keyed by its official reference. */
export const catalogBookSchema = z.object({
	referenceCode: z.string().min(1),
	title: z.string().min(1),
	shelfmark: z.string().min(1).optional(),
	folioCount: z.number().int().nonnegative().optional(),
	recordUrl: z.url().optional(),
	viewerUrl: z.url().optional(),
});
export type CatalogBook = z.infer<typeof catalogBookSchema>;

/**
 * Complete catalog of one fonds. `expectedBookCount` is the total announced by the source;
 * a mismatch with `books.length` marks the response as incomplete.
 */
export const catalogSnapshotSchema = z.object({
	fondsReference: z.string().min(1),
	title: z.string().min(1).optional(),
	expectedBookCount: z.number().int().nonnegative(),
	books: z.array(catalogBookSchema),
});
export type CatalogSnapshot = z.infer<typeof catalogSnapshotSchema>;

export const catalogErrorCodes = [
	"timeout",
	"network",
	"refused",
	"rate_limited",
	"http_error",
	"invalid_format",
	"incomplete",
	"not_configured",
	"storage_error",
] as const;
export const catalogErrorCodeSchema = z.enum(catalogErrorCodes);
export type CatalogErrorCode = z.infer<typeof catalogErrorCodeSchema>;

export const catalogReconciliationSchema = z.object({
	baseline: catalogBaselineSchema,
	books: z.number().int().nonnegative(),
	viewers: z.number().int().nonnegative(),
	bookDelta: z.number().int(),
	viewerDelta: z.number().int(),
	added: z.array(z.string()),
	missing: z.array(z.string()),
	changed: z.array(z.string()),
	viewersAdded: z.array(z.string()),
	viewersLost: z.array(z.string()),
	/** Missing books and lost viewers are never deleted automatically. */
	pendingReview: z.array(z.string()),
});
export type CatalogReconciliation = z.infer<typeof catalogReconciliationSchema>;

export const catalogRefreshOutcomeSchema = z.enum(["success", "failure"]);

export const catalogRefreshResultSchema = z.object({
	outcome: catalogRefreshOutcomeSchema,
	attemptedAt: z.iso.datetime(),
	errorCode: catalogErrorCodeSchema.optional(),
	message: z.string().optional(),
});

/**
 * `data` says where the books come from: `fresh` (last attempt succeeded), `stored_copy`
 * (last attempt failed, last valid catalog served) or `none` (no valid catalog ever stored).
 */
export const catalogStatusSchema = z.object({
	lastAttempt: catalogRefreshResultSchema.nullable(),
	lastSuccessAt: z.iso.datetime().nullable(),
	data: z.enum(["fresh", "stored_copy", "none"]),
	reconciliation: catalogReconciliationSchema.nullable(),
});
export type CatalogStatus = z.infer<typeof catalogStatusSchema>;

export const catalogResponseSchema = z.object({
	status: catalogStatusSchema,
	books: z.array(catalogBookSchema),
});
export type CatalogResponse = z.infer<typeof catalogResponseSchema>;

export const catalogRefreshResponseSchema = z.object({
	status: catalogStatusSchema,
	bookCount: z.number().int().nonnegative(),
	unchanged: z.boolean(),
});
export type CatalogRefreshResponse = z.infer<typeof catalogRefreshResponseSchema>;

export const catalogErrorResponseSchema = z.object({
	error: catalogErrorCodeSchema,
	message: z.string(),
	status: catalogStatusSchema,
});
export type CatalogErrorResponse = z.infer<typeof catalogErrorResponseSchema>;
