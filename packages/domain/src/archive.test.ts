import { describe, expect, it } from "vitest";
import { partialDateSchema, participantSchema, recordRevisionSchema } from "./archive.ts";

describe("archive contracts", () => {
	it("accepts incomplete and uncertain dates but rejects impossible dates", () => {
		expect(partialDateSchema.safeParse({ precision: "unknown" }).success).toBe(true);
		expect(
			partialDateSchema.safeParse({ year: 1800, precision: "year", qualifier: "circa" }).success,
		).toBe(true);
		expect(
			partialDateSchema.safeParse({ year: 1900, month: 2, day: 29, precision: "day" }).success,
		).toBe(false);
		expect(
			partialDateSchema.safeParse({ year: 2000, month: 2, day: 29, precision: "day" }).success,
		).toBe(true);
		expect(partialDateSchema.safeParse({ month: 2, precision: "month" }).success).toBe(false);
	});
	it("preserves spelling and accepts an incomplete record", () => {
		expect(
			participantSchema.parse({ role: "other", nameAsWritten: "  Joaõ d'Abreu  ", position: 0 })
				.nameAsWritten,
		).toBe("  Joaõ d'Abreu  ");
		expect(
			recordRevisionSchema.safeParse({
				recordType: "baptism",
				provenance: { sourceId: "3e54c889-2694-4e64-8b53-9e75fa2376ae", method: "manual" },
			}).success,
		).toBe(true);
	});
});
