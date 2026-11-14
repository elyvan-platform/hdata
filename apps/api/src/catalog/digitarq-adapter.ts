import { type CatalogErrorCode, type CatalogSnapshot, catalogSnapshotSchema } from "@hdata/domain";

export class CatalogError extends Error {
	readonly code: CatalogErrorCode;

	constructor(code: CatalogErrorCode, message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "CatalogError";
		this.code = code;
	}
}

export type AdapterOptions = {
	url: string;
	fondsReference: string;
	timeoutMs: number;
	/** Extra attempts, used only for transient failures (timeout, network, 5xx). */
	retries?: number;
	fetch?: typeof fetch;
};

const transient: readonly CatalogErrorCode[] = ["timeout", "network", "http_error"];

async function fetchOnce(options: AdapterOptions): Promise<unknown> {
	const doFetch = options.fetch ?? fetch;
	let response: Response;
	try {
		response = await doFetch(options.url, {
			headers: { accept: "application/json" },
			signal: AbortSignal.timeout(options.timeoutMs),
		});
	} catch (error) {
		if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"))
			throw new CatalogError("timeout", `No answer within ${options.timeoutMs} ms`, {
				cause: error,
			});
		throw new CatalogError("network", "Could not reach the catalog (DNS, TLS or connection)", {
			cause: error,
		});
	}
	if (response.status === 429)
		throw new CatalogError("rate_limited", "The catalog is limiting requests (HTTP 429)");
	if (response.status === 401 || response.status === 403)
		throw new CatalogError("refused", `The catalog refused the request (HTTP ${response.status})`);
	if (!response.ok)
		throw new CatalogError("http_error", `The catalog answered HTTP ${response.status}`);
	try {
		return await response.json();
	} catch (error) {
		throw new CatalogError("invalid_format", "The catalog response is not valid JSON", {
			cause: error,
		});
	}
}

/** Checks that a parsed snapshot is the complete catalog of the expected fonds. */
export function validateSnapshot(body: unknown, fondsReference: string): CatalogSnapshot {
	const parsed = catalogSnapshotSchema.safeParse(body);
	if (!parsed.success)
		throw new CatalogError("invalid_format", "The catalog response has an unexpected shape", {
			cause: parsed.error,
		});
	const snapshot = parsed.data;
	if (snapshot.fondsReference !== fondsReference)
		throw new CatalogError(
			"invalid_format",
			`Response is for fonds ${snapshot.fondsReference}, expected ${fondsReference}`,
		);
	if (snapshot.books.length === 0 || snapshot.books.length !== snapshot.expectedBookCount)
		throw new CatalogError(
			"incomplete",
			`Received ${snapshot.books.length} books, the source announces ${snapshot.expectedBookCount}`,
		);
	const seen = new Set<string>();
	for (const book of snapshot.books) {
		if (!book.referenceCode.startsWith(fondsReference))
			throw new CatalogError(
				"invalid_format",
				`Book ${book.referenceCode} does not belong to ${fondsReference}`,
			);
		if (seen.has(book.referenceCode))
			throw new CatalogError("invalid_format", `Duplicate reference ${book.referenceCode}`);
		seen.add(book.referenceCode);
	}
	return snapshot;
}

/** Fetches and validates the whole catalog; any failure throws a `CatalogError`. */
export async function fetchCatalog(options: AdapterOptions): Promise<CatalogSnapshot> {
	const attempts = (options.retries ?? 1) + 1;
	for (let attempt = 1; ; attempt++) {
		try {
			return validateSnapshot(await fetchOnce(options), options.fondsReference);
		} catch (error) {
			if (!(error instanceof CatalogError)) throw error;
			if (attempt >= attempts || !transient.includes(error.code)) throw error;
		}
	}
}
