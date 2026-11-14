import {
	type CatalogBaseline,
	type CatalogBook,
	type CatalogReconciliation,
	type CatalogSnapshot,
	knownCatalogBaseline,
} from "@hdata/domain";

export type StoredBook = {
	referenceCode: string;
	title: string;
	shelfmark: string | null;
	folioCount: number | null;
	recordUrl: string | null;
	viewerUrl: string | null;
};

const fingerprint = (b: {
	title: string;
	shelfmark?: string | null | undefined;
	folioCount?: number | null | undefined;
	recordUrl?: string | null | undefined;
	viewerUrl?: string | null | undefined;
}) =>
	JSON.stringify([
		b.title,
		b.shelfmark ?? null,
		b.folioCount ?? null,
		b.recordUrl ?? null,
		b.viewerUrl ?? null,
	]);

/**
 * Compares a validated snapshot with the stored books by official reference. Nothing is
 * deleted: books or viewers that disappeared are reported as pending review.
 */
export function reconcileCatalog(
	snapshot: CatalogSnapshot,
	stored: readonly StoredBook[],
	baseline: CatalogBaseline = knownCatalogBaseline,
): CatalogReconciliation {
	const known = new Map(stored.map((b) => [b.referenceCode, b]));
	const incoming = new Map<string, CatalogBook>(snapshot.books.map((b) => [b.referenceCode, b]));
	const added: string[] = [];
	const changed: string[] = [];
	const viewersAdded: string[] = [];
	const viewersLost: string[] = [];
	for (const [reference, book] of incoming) {
		const before = known.get(reference);
		if (!before) {
			added.push(reference);
			if (book.viewerUrl) viewersAdded.push(reference);
			continue;
		}
		if (book.viewerUrl && !before.viewerUrl) viewersAdded.push(reference);
		if (!book.viewerUrl && before.viewerUrl) viewersLost.push(reference);
		const merged = { ...book, viewerUrl: book.viewerUrl ?? before.viewerUrl };
		if (fingerprint(merged) !== fingerprint(before)) changed.push(reference);
	}
	const missing = stored.map((b) => b.referenceCode).filter((r) => !incoming.has(r));
	const viewers = snapshot.books.filter((b) => b.viewerUrl).length;
	return {
		baseline,
		books: snapshot.books.length,
		viewers,
		bookDelta: snapshot.books.length - baseline.books,
		viewerDelta: viewers - baseline.viewers,
		added: added.sort(),
		missing: missing.sort(),
		changed: changed.sort(),
		viewersAdded: viewersAdded.sort(),
		viewersLost: viewersLost.sort(),
		pendingReview: [...new Set([...missing, ...viewersLost])].sort(),
	};
}
