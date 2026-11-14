/**
 * Manuscript excerpt shown beside the home page title. It stays unset until an image of an
 * authentic Vila Caiz manuscript has been added under `public/` with its reuse conditions
 * verified with the archive (ADPRT); never point it at an image whose rights are unknown.
 */
export type Specimen = {
	src: string;
	width: number;
	height: number;
	alt: string;
	/** Archival reference of the book and folio, e.g. "PT/ADPRT/PRQ/PAMT38/001, fl. 12". */
	reference: string;
	/** Link to the source in the official archive. */
	sourceUrl: string;
	/** Reuse conditions confirmed with the archive. */
	rights: string;
};

export const specimen: Specimen | undefined = undefined;
