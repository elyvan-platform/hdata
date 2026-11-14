import { z } from "zod";
import { partialDateSchema, recordTypeSchema } from "./archive.ts";

export const historicalEntrySchema = z.object({
	externalId: z.string().min(1),
	recordType: recordTypeSchema,
	kind: z.enum(["index", "transcription"]),
	bookReference: z.string().min(1).optional(),
	locator: z.string().min(1).optional(),
	tif: z.string().min(1).optional(),
	text: z.string().optional(),
	date: partialDateSchema.optional(),
	confidence: z.enum(["unknown", "low", "medium", "high"]).default("unknown"),
	raw: z.record(z.string(), z.unknown()),
});
export const historicalMappingSchema = z.object({
	sourceId: z.uuid(),
	citation: z.string().min(1),
	reuseEvidence: z.string().min(1),
	kind: z.enum(["index", "transcription"]),
	recordType: recordTypeSchema.optional(),
	sheet: z.string().optional(),
	columns: z.object({
		externalId: z.string().min(1),
		recordType: z.string().optional(),
		bookReference: z.string().optional(),
		locator: z.string().optional(),
		tif: z.string().optional(),
		text: z.string().optional(),
		confidence: z.string().optional(),
		date: z.string().optional(),
	}),
});
export const historicalStoredEntrySchema = z.object({
	sourceId: z.uuid(),
	citation: z.string().min(1),
	reuseEvidence: z.string().min(1),
	entry: historicalEntrySchema,
});
export type HistoricalEntry = z.infer<typeof historicalEntrySchema>;
export type HistoricalMapping = z.infer<typeof historicalMappingSchema>;
export type HistoricalStoredEntry = z.infer<typeof historicalStoredEntrySchema>;
export const historicalBaseline = { baptism: 484, marriage: 254 } as const;
