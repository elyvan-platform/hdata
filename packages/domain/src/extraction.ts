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

export function hasIllegible(seat: ProposedSeat): boolean {
	return (
		seat.originalText.value.includes(illegibleMarker) ||
		seat.participants.some((p) => p.participant.legibility !== "legible")
	);
}

export const extractionRunStatuses = ["queued", "running", "succeeded", "failed"] as const;
export const proposalReviewStatuses = ["pending", "accepted", "rejected"] as const;
export const proposalReviewStatusSchema = z.enum(proposalReviewStatuses);
