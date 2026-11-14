import { z } from "zod";
import { partialDateSchema, recordTypeSchema, validationStatusSchema } from "./archive.ts";

/** Normalize only for comparison; retain source text for display and storage. */
export function normalizeSearchText(value: string): string {
	return value
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.toLocaleLowerCase("pt-PT")
		.replace(/\b(?:vila|villa)\s+(?:caiz|cahiz)\b/g, "vila caiz")
		.replace(/\b(?:vilarinho|villarinho)\b/g, "vilarinho")
		.replace(/\s+/g, " ")
		.trim();
}

export const searchPageSize = { default: 20, max: 50 } as const;

const optionalText = z
	.string()
	.trim()
	.max(200)
	.transform((value) => (value === "" ? undefined : value))
	.optional();
const optionalYear = z.coerce.number().int().min(1).max(9999).optional();

/** Query string of `GET /search`; empty strings count as absent so HTML forms can submit as is. */
export const searchQuerySchema = z
	.object({
		q: optionalText,
		type: z.preprocess((v) => (v === "" ? undefined : v), recordTypeSchema.optional()),
		book: optionalText,
		from: z.preprocess((v) => (v === "" ? undefined : v), optionalYear),
		to: z.preprocess((v) => (v === "" ? undefined : v), optionalYear),
		page: z.preprocess(
			(v) => (v === "" ? undefined : v),
			z.coerce.number().int().min(1).default(1),
		),
		pageSize: z.preprocess(
			(v) => (v === "" ? undefined : v),
			z.coerce.number().int().min(1).max(searchPageSize.max).default(searchPageSize.default),
		),
	})
	.refine((query) => query.from === undefined || query.to === undefined || query.from <= query.to, {
		message: "from must not be after to",
		path: ["from"],
	});
export type SearchQuery = z.infer<typeof searchQuerySchema>;
/** What a caller may pass: everything optional, as it appears in a URL. */
export type SearchQueryInput = z.input<typeof searchQuerySchema>;

export const searchBookSchema = z.object({
	referenceCode: z.string().nullable(),
	title: z.string(),
	recordUrl: z.string().nullable(),
	viewerUrl: z.string().nullable(),
});

export const searchImageSchema = z.object({
	id: z.uuid(),
	folio: z.string().nullable(),
	side: z.string(),
	url: z.string().nullable(),
});

export const searchParticipantSchema = z.object({
	role: z.string(),
	name: z.string(),
	legibility: z.enum(["legible", "uncertain", "illegible"]),
});

/** A published seat as shown in results and on its page; spelling is the source's, never normalized. */
export const searchResultSchema = z.object({
	recordId: z.uuid(),
	recordType: recordTypeSchema,
	status: validationStatusSchema,
	date: partialDateSchema.nullable(),
	place: z.string().nullable(),
	folio: z.string().nullable(),
	locator: z.string().nullable(),
	participants: z.array(searchParticipantSchema),
	/** Where the revision comes from: the source's name/kind and how it entered (import or manual). */
	origin: z.object({
		sourceName: z.string(),
		sourceKind: z.string(),
		citation: z.string().nullable(),
		method: z.enum(["manual", "import"]),
	}),
	book: searchBookSchema,
	images: z.array(searchImageSchema),
});
export type SearchResult = z.infer<typeof searchResultSchema>;

export const searchResponseSchema = z.object({
	total: z.number().int().nonnegative(),
	page: z.number().int().min(1),
	pageSize: z.number().int().min(1),
	results: z.array(searchResultSchema),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;

/** Real coverage: only what is published, per book; a book without seats is listed with zero. */
export const coverageResponseSchema = z.object({
	publishedRecords: z.number().int().nonnegative(),
	books: z.array(
		z.object({
			referenceCode: z.string().nullable(),
			title: z.string(),
			publishedRecords: z.number().int().nonnegative(),
		}),
	),
});
export type CoverageResponse = z.infer<typeof coverageResponseSchema>;
