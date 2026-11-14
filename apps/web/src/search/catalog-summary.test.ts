import type { CatalogBook } from "@hdata/domain";
import { describe, expect, it } from "vitest";
import { bookType, summarizeCatalog } from "./catalog-summary.ts";

const book = (title: string, viewerUrl?: string): CatalogBook => ({
	referenceCode: title,
	title,
	viewerUrl,
});

describe("summarizeCatalog", () => {
	it("groups by series with period and image availability from the titles and links", () => {
		const summary = summarizeCatalog([
			book("Registo de Baptismos 1663-1700", "https://example.org/v/1"),
			book("Registo de Batismos 1701-1750"),
			book("Registo de Óbitos 1800-1850"),
			book("Livro misto"),
		]);
		expect(summary[0]).toEqual({
			type: "baptism",
			books: 2,
			period: { from: 1663, to: 1750 },
			withImages: 1,
		});
		expect(summary[1]).toEqual({ type: "marriage", books: 0, period: undefined, withImages: 0 });
		expect(summary[2]?.period).toEqual({ from: 1800, to: 1850 });
	});

	it("does not attribute books whose title names no series", () => {
		expect(bookType(book("Livro misto"))).toBeUndefined();
	});
});
