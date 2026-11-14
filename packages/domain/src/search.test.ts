import { describe, expect, it } from "vitest";
import { normalizeSearchText } from "./search.ts";

describe("normalizeSearchText", () => {
	it("matches accents, case and whitespace without changing the original", () => {
		const original = "  JOÃO  Álvares  ";
		expect(normalizeSearchText(original)).toBe("joao alvares");
		expect(original).toBe("  JOÃO  Álvares  ");
	});

	it("matches documented historical place variants", () => {
		expect(normalizeSearchText("Villa Cahiz")).toBe(normalizeSearchText("Vila Caiz"));
		expect(normalizeSearchText("Villarinho")).toBe(normalizeSearchText("Vilarinho"));
	});

	it("does not replace variants inside unrelated words", () => {
		expect(normalizeSearchText("Villarinhozinho")).toBe("villarinhozinho");
	});
});
