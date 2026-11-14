import type { SearchResult } from "@hdata/domain";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, expect, it, vi } from "vitest";
import { SourceLinks } from "./source-links.tsx";

// Vite's default JSX transform is classic; Next.js uses its own automatic transform.
vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());
const record: SearchResult = {
	recordId: "00000000-0000-4000-8000-000000000001",
	recordType: "death",
	status: "published",
	date: null,
	place: null,
	folio: null,
	locator: null,
	participants: [],
	origin: { sourceName: "Synthetic", sourceKind: "primary", citation: null, method: "import" },
	book: { referenceCode: "TEST/1", title: "Synthetic", recordUrl: null, viewerUrl: null },
	images: [],
};
it("states when the source link is unavailable", () => {
	const html = renderToStaticMarkup(SourceLinks({ record }));
	expect(html).toContain("Sem ligação à fonte disponível");
	expect(html).not.toContain("<a");
});
it("renders official links and labels an image without a URL", () => {
	const html = renderToStaticMarkup(
		SourceLinks({
			record: {
				...record,
				book: {
					...record.book,
					recordUrl: "https://example.org/record",
					viewerUrl: "https://example.org/viewer",
				},
				images: [{ id: record.recordId, folio: "9", side: "recto", url: null }],
			},
		}),
	);
	expect(html).toContain('href="https://example.org/record"');
	expect(html).toContain('href="https://example.org/viewer"');
	expect(html).toContain("fólio 9 (frente) — sem ligação disponível");
	expect(html).not.toContain('href="null"');
});
