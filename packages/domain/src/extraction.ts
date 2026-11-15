import { z } from "zod";
import { imageLinkSchema, participantSchema, recordTypeSchema } from "./archive.ts";

/** Marker a model must put in the text wherever the handwriting cannot be read. */
export const illegibleMarker = "[ilegível]";

/**
 * Model confidence is a self-reported estimate, not a calibrated probability, until a measured
 * calibration exists (see docs/extraction-pilot.md). Every stored confidence carries this kind.
 */
export const confidenceKinds = ["estimate"] as const;
export const confidenceSchema = z.number().min(0).max(1);

const field = <T extends z.ZodType>(value: T) => z.object({ value, confidence: confidenceSchema });

export const proposedParticipantSchema = z.object({
	participant: participantSchema,
	confidence: confidenceSchema,
});

/** One seat (assento) as the model read it, in the original Portuguese, never normalised. */
export const proposedSeatSchema = z.object({
	recordType: field(recordTypeSchema),
	originalText: field(z.string().min(1)),
	folio: field(z.string().nullable()),
	placeAsWritten: field(z.string().nullable()),
	dateAsWritten: field(z.string().nullable()),
	marginalNotes: field(z.string().nullable()),
	participants: z.array(proposedParticipantSchema),
	region: imageLinkSchema.shape.region.unwrap().nullable(),
});
export type ProposedSeat = z.infer<typeof proposedSeatSchema>;

/** What the model must return for one image. */
export const modelOutputSchema = z.object({ seats: z.array(proposedSeatSchema) });
export type ModelOutput = z.infer<typeof modelOutputSchema>;

export function seatFieldConfidences(seat: ProposedSeat): number[] {
	return [
		seat.recordType.confidence,
		seat.originalText.confidence,
		seat.folio.confidence,
		seat.placeAsWritten.confidence,
		seat.dateAsWritten.confidence,
		seat.marginalNotes.confidence,
		...seat.participants.map((p) => p.confidence),
	];
}

/** Seat confidence is the lowest field confidence: a seat is only as reliable as its weakest field. */
export function seatConfidence(seat: ProposedSeat): number {
	return Math.min(...seatFieldConfidences(seat));
}

export function summarizeSeatConfidence(seat: ProposedSeat) {
	const fields = [
		{ field: "Tipo de assento", ...seat.recordType },
		{ field: "Texto", ...seat.originalText },
		{ field: "Fólio", ...seat.folio },
		{ field: "Lugar", ...seat.placeAsWritten },
		{ field: "Data", ...seat.dateAsWritten },
		{ field: "Notas marginais", ...seat.marginalNotes },
		...seat.participants.map(({ participant, confidence }) => ({
			field: `Nome (${participant.role})`,
			value: participant.nameAsWritten,
			confidence,
		})),
	].filter(({ value }) => value?.trim() && value.trim() !== illegibleMarker);
	const sorted = fields.sort((a, b) => a.confidence - b.confidence);
	const low = sorted[0];
	const high = sorted.at(-1);
	if (!low || !high) return undefined;
	return {
		min: low.confidence,
		minField: low.field,
		max: high.confidence,
		mean: sorted.reduce((sum, entry) => sum + entry.confidence, 0) / sorted.length,
	};
}

export function hasIllegible(seat: ProposedSeat): boolean {
	return (
		seat.originalText.value.includes(illegibleMarker) ||
		seat.participants.some((p) => p.participant.legibility !== "legible")
	);
}

export const extractionRunStatuses = ["queued", "running", "succeeded", "failed"] as const;
export const proposalReviewStatuses = ["pending", "accepted", "rejected"] as const;
export const proposalReviewStatusSchema = z.enum(proposalReviewStatuses);

export const proposalListSchema = z.object({
	items: z.array(
		z.object({
			id: z.uuid(),
			book: z.string(),
			viewerUrl: z.url(),
			sequence: z.number().int().positive(),
			confidence: z.number().min(0).max(1),
			text: z.string(),
			confidenceSummary: z
				.object({
					min: confidenceSchema,
					minField: z.string(),
					max: confidenceSchema,
					mean: confidenceSchema,
				})
				.optional(),
			namesToConfirm: z.boolean().optional(),
		}),
	),
});

export const bookExtractionRequestSchema = z.object({
	book: z.string().min(1).max(120),
	first: z.coerce.number().int().min(1).max(100_000),
	limit: z.coerce.number().int().min(1).max(20),
	enqueue: z.boolean(),
	retryFailed: z.boolean().optional(),
	rightsEvidence: z.string().trim().min(12).max(1000).optional(),
});
export const bookExtractionStatusSchema = z.object({
	total: z.number().int().nonnegative(),
	pages: z.array(
		z.object({
			page: z.number().int().positive(),
			viewerUrl: z.url(),
			status: z.enum(["not_queued", "queued", "running", "succeeded", "failed"]),
			error: z.string().nullable(),
			proposalCount: z.number().int().nonnegative().optional(),
		}),
	),
});
