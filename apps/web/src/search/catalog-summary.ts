import type { CatalogBook, RecordType } from "@hdata/domain";

export const summarizedTypes = ["baptism", "marriage", "death"] as const satisfies RecordType[];
export type SummarizedType = (typeof summarizedTypes)[number];

/** Official fonds of Vila Caiz in the ADPRT Digitarq, used when no valid catalog exists. */
export const fondsUrl = "https://pesquisa.adporto.arquivos.pt/details?id=537856";

export type TypeSummary = {
	type: SummarizedType;
	books: number;
	/** First and last year found in the book titles; undefined when no title states a period. */
	period?: { from: number; to: number };
	/** Books that link to a digitised-image viewer. */
	withImages: number;
};

const typePatterns: Record<SummarizedType, RegExp> = {
	baptism: /batism|baptism/,
	marriage: /casament/,
	death: /obit/,
};

const normalize = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Book type from its title; books whose title names no series are not attributed to any. */
export function bookType(book: CatalogBook): SummarizedType | undefined {
	const title = normalize(book.title);
	return summarizedTypes.find((type) => typePatterns[type].test(title));
}

const yearPattern = /\b(1[5-9]\d\d)\b/g;

/** Summarises the real catalog per series: counts, period stated by titles and image availability. */
export function summarizeCatalog(books: CatalogBook[]): TypeSummary[] {
	return summarizedTypes.map((type) => {
		const own = books.filter((book) => bookType(book) === type);
		const years = own.flatMap((book) =>
			[...book.title.matchAll(yearPattern)].map((m) => Number(m[1])),
		);
		return {
			type,
			books: own.length,
			period: years.length > 0 ? { from: Math.min(...years), to: Math.max(...years) } : undefined,
			withImages: own.filter((book) => book.viewerUrl).length,
		};
	});
}
