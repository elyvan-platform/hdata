import { z } from "zod";

export const recordTypes = ["baptism", "marriage", "death", "undetermined"] as const;
export const validationStatuses = [
	"draft",
	"in_review",
	"validated",
	"rejected",
	"published",
] as const;
export const recordTypeSchema = z.enum(recordTypes);
export const validationStatusSchema = z.enum(validationStatuses);
export const partialDateSchema = z
	.object({
		year: z.number().int().min(1).max(9999).optional(),
		month: z.number().int().min(1).max(12).optional(),
		day: z.number().int().min(1).max(31).optional(),
		precision: z.enum(["unknown", "year", "month", "day"]),
		qualifier: z.enum(["exact", "circa", "before", "after", "uncertain"]).default("exact"),
		asWritten: z.string().optional(),
	})
	.superRefine((date, ctx) => {
		const expected =
			date.day !== undefined
				? "day"
				: date.month !== undefined
					? "month"
					: date.year !== undefined
						? "year"
						: "unknown";
		if (
			date.precision !== expected ||
			(date.day !== undefined && date.month === undefined) ||
			(date.month !== undefined && date.year === undefined)
		)
			ctx.addIssue({ code: "custom", message: "Date fields and precision must agree" });
		if (date.year !== undefined && date.month !== undefined && date.day !== undefined) {
			const leap = date.year % 4 === 0 && (date.year % 100 !== 0 || date.year % 400 === 0);
			const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
			if (date.day > (days[date.month - 1] ?? 0))
				ctx.addIssue({ code: "custom", message: "Invalid calendar date" });
		}
	});
const id = z.uuid();
const externalIdentity = { sourceId: id, externalId: z.string().min(1).optional() };
export const sourceSchema = z.object({
	name: z.string().min(1),
	kind: z.string().min(1),
	citation: z.string().optional(),
	url: z.url().optional(),
	rightsStatus: z.string().default("unknown"),
	accessedAt: z.iso.datetime().optional(),
});
export const archivalUnitSchema = z.object({
	...externalIdentity,
	parentId: id.optional(),
	level: z.enum(["fonds", "series", "subseries"]),
	referenceCode: z.string().optional(),
	title: z.string().min(1),
	startDate: partialDateSchema.optional(),
	endDate: partialDateSchema.optional(),
});
export const bookSchema = z.object({
	...externalIdentity,
	archivalUnitId: id,
	referenceCode: z.string().optional(),
	shelfmark: z.string().optional(),
	title: z.string().min(1),
	startDate: partialDateSchema.optional(),
	endDate: partialDateSchema.optional(),
	folioCount: z.number().int().nonnegative().optional(),
	sourceUrl: z.url().optional(),
});
export const imageRefSchema = z.object({
	...externalIdentity,
	bookId: id,
	sequence: z.number().int().nonnegative(),
	folio: z.string().optional(),
	side: z.enum(["recto", "verso", "unknown"]).default("unknown"),
	url: z.url().optional(),
	storageKey: z.string().optional(),
	rightsStatus: z.string().default("unknown"),
});
export const importBatchSchema = z.object({
	sourceId: id,
	externalId: z.string().min(1).optional(),
});
export const provenanceSchema = z.object({
	sourceId: id,
	method: z.enum(["manual", "import"]),
	importBatchId: id.optional(),
	locator: z.string().optional(),
	recordedBy: z.string().optional(),
	recordedAt: z.iso.datetime().optional(),
});
export const participantSchema = z.object({
	role: z.string().min(1),
	nameAsWritten: z.string().min(1),
	normalizedName: z.string().optional(),
	legibility: z.enum(["legible", "uncertain", "illegible"]).default("legible"),
	roleAsWritten: z.string().optional(),
	notes: z.string().optional(),
	position: z.number().int().nonnegative(),
});
export const imageLinkSchema = z.object({
	imageId: id,
	region: z
		.object({
			x: z.number().min(0).max(1),
			y: z.number().min(0).max(1),
			w: z.number().positive().max(1),
			h: z.number().positive().max(1),
		})
		.refine((r) => r.x + r.w <= 1 && r.y + r.h <= 1)
		.optional(),
});
export const recordRevisionSchema = z.object({
	recordType: recordTypeSchema,
	date: partialDateSchema.optional(),
	folio: z.string().optional(),
	placeAsWritten: z.string().optional(),
	normalizedPlace: z.string().optional(),
	originalText: z.string().optional(),
	marginalNotes: z.string().optional(),
	status: validationStatusSchema.default("draft"),
	provenance: provenanceSchema,
	participants: z.array(participantSchema).default([]),
	images: z.array(imageLinkSchema).default([]),
});
export const recordImportSchema = z
	.object({
		sourceId: id,
		externalId: z.string().min(1),
		bookId: id,
		revision: recordRevisionSchema,
	})
	.refine((value) => value.sourceId === value.revision.provenance.sourceId, {
		message: "Record and provenance sources must match",
	});
export type RecordImport = z.infer<typeof recordImportSchema>;
