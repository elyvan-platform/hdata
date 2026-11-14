import { type ProposedSeat, seatConfidence } from "@hdata/domain";

/** A manually reviewed seat: the reference transcription a proposal is measured against. */
export type ReviewedSeat = { originalText: string; recordType: string; folio?: string | null };

export function editDistance(a: string, b: string): number {
	let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		const current = [i];
		for (let j = 1; j <= b.length; j++)
			current[j] = Math.min(
				(previous[j] ?? 0) + 1,
				(current[j - 1] ?? 0) + 1,
				(previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
			);
		previous = current;
	}
	return previous[b.length] ?? 0;
}

const normalize = (text: string) => text.normalize("NFC").replace(/\s+/g, " ").trim();

export type PilotMetrics = {
	reviewedSeats: number;
	proposedSeats: number;
	matchedSeats: number;
	/** Seats found / seats that exist. */
	seatRecall: number;
	/** Seats that match a reviewed seat / seats proposed. */
	seatPrecision: number;
	/** Edit distance over reference characters, matched seats only (whitespace-normalised). */
	characterErrorRate: number;
	recordTypeAccuracy: number;
	/** Mean seat confidence vs. fraction of matched seats with CER <= 0.1: calibration evidence. */
	meanConfidence: number;
	fractionWithinTolerance: number;
};

/**
 * Pairs each reviewed seat with the unused proposal closest in text (same order is not assumed),
 * ignoring pairs whose character error rate exceeds 0.8, which count as a missed seat.
 */
export function evaluatePilot(proposed: ProposedSeat[], reviewed: ReviewedSeat[]): PilotMetrics {
	const unused = new Set(proposed.keys());
	let errors = 0;
	let chars = 0;
	let typeHits = 0;
	let matched = 0;
	let confidenceSum = 0;
	let within = 0;
	for (const ref of reviewed) {
		const refText = normalize(ref.originalText);
		let best: { index: number; distance: number } | undefined;
		for (const index of unused) {
			const seat = proposed[index];
			if (!seat) continue;
			const distance = editDistance(normalize(seat.originalText.value), refText);
			if (!best || distance < best.distance) best = { index, distance };
		}
		const seat = best && proposed[best.index];
		if (!best || !seat || best.distance / Math.max(refText.length, 1) > 0.8) continue;
		unused.delete(best.index);
		matched++;
		errors += best.distance;
		chars += refText.length;
		if (seat.recordType.value === ref.recordType) typeHits++;
		confidenceSum += seatConfidence(seat);
		if (best.distance / Math.max(refText.length, 1) <= 0.1) within++;
	}
	const ratio = (n: number, d: number) => (d === 0 ? 0 : n / d);
	return {
		reviewedSeats: reviewed.length,
		proposedSeats: proposed.length,
		matchedSeats: matched,
		seatRecall: ratio(matched, reviewed.length),
		seatPrecision: ratio(matched, proposed.length),
		characterErrorRate: ratio(errors, chars),
		recordTypeAccuracy: ratio(typeHits, matched),
		meanConfidence: ratio(confidenceSum, matched),
		fractionWithinTolerance: ratio(within, matched),
	};
}
