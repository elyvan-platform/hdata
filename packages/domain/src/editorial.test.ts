import { describe, expect, it } from "vitest";
import { can, mergeRevisionContent, revisionContentSchema } from "./editorial.ts";

const base = revisionContentSchema.parse({ originalText: "a", folio: "1" });

describe("can", () => {
	it("grants each role only its actions", () => {
		expect(can("editor", "edit")).toBe(true);
		expect(can("editor", "validate")).toBe(false);
		expect(can("reviewer", "reject")).toBe(true);
		expect(can("reviewer", "publish")).toBe(false);
		expect(can("publisher", "edit")).toBe(false);
		expect(can("publisher", "publish")).toBe(true);
		expect(can("admin", "publish")).toBe(true);
	});
});

describe("mergeRevisionContent", () => {
	it("takes disjoint changes from both sides", () => {
		const result = mergeRevisionContent(
			base,
			{ ...base, folio: "2" },
			{ ...base, originalText: "b" },
		);
		expect(result).toEqual({ ok: true, content: { ...base, folio: "2", originalText: "b" } });
	});
	it("accepts identical changes and reports differing ones", () => {
		expect(mergeRevisionContent(base, { ...base, folio: "2" }, { ...base, folio: "2" }).ok).toBe(
			true,
		);
		const result = mergeRevisionContent(base, { ...base, folio: "2" }, { ...base, folio: "3" });
		expect(result).toEqual({
			ok: false,
			conflicts: [{ field: "folio", base: "1", mine: "2", theirs: "3" }],
		});
	});
});
