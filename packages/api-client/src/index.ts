import {
	type CatalogErrorResponse,
	type CatalogRefreshResponse,
	type CatalogResponse,
	type CoverageResponse,
	catalogErrorResponseSchema,
	catalogRefreshResponseSchema,
	catalogResponseSchema,
	coverageResponseSchema,
	type EditorialDecision,
	type EditorialError,
	type EditRevisionRequest,
	editorialErrorSchema,
	type Fiche,
	ficheSchema,
	type HealthResponse,
	healthResponseSchema,
	type ReadyResponse,
	type ReviewQueueResponse,
	type RevisionView,
	readyResponseSchema,
	reviewQueueResponseSchema,
	revisionViewSchema,
	type SearchQueryInput,
	type SearchResponse,
	type SearchResult,
	searchResponseSchema,
	searchResultSchema,
	type VersionResponse,
	versionResponseSchema,
} from "@hdata/domain";
import { type ZodType, z } from "zod";

export class ApiError extends Error {
	readonly status: number;
	/** Present when the API answered a catalog refresh failure with its typed payload. */
	readonly catalogError: CatalogErrorResponse | undefined;

	constructor(
		message: string,
		status: number,
		catalogError?: CatalogErrorResponse,
		editorialError?: EditorialError,
	) {
		super(message);
		this.editorialError = editorialError;
		this.name = "ApiError";
		this.status = status;
		this.catalogError = catalogError;
	}

	/** Present when the API answered an editorial request with its typed error (e.g. a conflict). */
	readonly editorialError: EditorialError | undefined;

	/** 401/403: the caller is not authenticated or not allowed. */
	get isAuthError(): boolean {
		return this.status === 401 || this.status === 403;
	}
}

export type ApiClientOptions = {
	baseUrl: string;
	fetch?: typeof fetch;
};

export function createApiClient(options: ApiClientOptions) {
	const doFetch = options.fetch ?? fetch;
	const base = options.baseUrl.replace(/\/+$/, "");

	async function request<T>(
		path: string,
		schema: ZodType<T>,
		acceptedStatuses: readonly number[] = [],
	): Promise<T> {
		const response = await doFetch(`${base}${path}`, { headers: { accept: "application/json" } });
		if (!response.ok && !acceptedStatuses.includes(response.status)) {
			throw new ApiError(`GET ${path} failed with status ${response.status}`, response.status);
		}
		const body: unknown = await response.json();
		return schema.parse(body);
	}

	return {
		health: (): Promise<HealthResponse> => request("/health", healthResponseSchema),
		/** A 503 carries a valid "not_ready" payload, so it is returned, not thrown. */
		ready: (): Promise<ReadyResponse> => request("/ready", readyResponseSchema, [503]),
		catalog: (): Promise<CatalogResponse> => request("/catalog", catalogResponseSchema),
		/** Refresh failures throw an `ApiError`; `catalogError` carries the code and stored-copy status. */
		async refreshCatalog(token: string): Promise<CatalogRefreshResponse> {
			const response = await doFetch(`${base}/catalog/refresh`, {
				method: "POST",
				headers: { accept: "application/json", authorization: `Bearer ${token}` },
			});
			const body: unknown = await response.json().catch(() => undefined);
			if (!response.ok) {
				const typed = catalogErrorResponseSchema.safeParse(body);
				throw new ApiError(
					`POST /catalog/refresh failed with status ${response.status}`,
					response.status,
					typed.success ? typed.data : undefined,
				);
			}
			return catalogRefreshResponseSchema.parse(body);
		},
		/** Editorial review; every call is made with the caller's own bearer token. */
		review(token: string) {
			async function call<T>(
				method: "GET" | "POST",
				path: string,
				schema: ZodType<T>,
				body?: unknown,
			): Promise<T> {
				const response = await doFetch(`${base}${path}`, {
					method,
					headers: {
						accept: "application/json",
						authorization: `Bearer ${token}`,
						...(body === undefined ? {} : { "content-type": "application/json" }),
					},
					...(body === undefined ? {} : { body: JSON.stringify(body) }),
				});
				const payload: unknown = await response.json().catch(() => undefined);
				if (!response.ok) {
					const typed = editorialErrorSchema.safeParse(payload);
					throw new ApiError(
						`${method} ${path} failed with status ${response.status}`,
						response.status,
						undefined,
						typed.success ? typed.data : undefined,
					);
				}
				return schema.parse(payload);
			}
			return {
				queue: (): Promise<ReviewQueueResponse> =>
					call("GET", "/review/queue", reviewQueueResponseSchema),
				fiche: (recordId: string): Promise<Fiche> =>
					call("GET", `/review/records/${recordId}`, ficheSchema),
				async edit(
					recordId: string,
					request: EditRevisionRequest,
				): Promise<{ revision: RevisionView; merged: boolean }> {
					return call(
						"POST",
						`/review/records/${recordId}/revisions`,
						z.object({ revision: revisionViewSchema, merged: z.boolean() }),
						request,
					);
				},
				decide: (
					recordId: string,
					decision: EditorialDecision,
					body: { revisionId: string; note?: string },
				): Promise<RevisionView> =>
					call("POST", `/review/records/${recordId}/${decision}`, revisionViewSchema, body),
			};
		},
		/** Published seats only; empty parameters are omitted so the API applies its defaults. */
		search(query: SearchQueryInput = {}): Promise<SearchResponse> {
			const params = new URLSearchParams();
			for (const [key, value] of Object.entries(query))
				if (value !== undefined && value !== "") params.set(key, String(value));
			const suffix = params.size > 0 ? `?${params}` : "";
			return request(`/search${suffix}`, searchResponseSchema);
		},
		coverage: (): Promise<CoverageResponse> => request("/search/coverage", coverageResponseSchema),
		/** A record that is not published (or does not exist) throws an `ApiError` with status 404. */
		record: (recordId: string): Promise<SearchResult> =>
			request(`/records/${encodeURIComponent(recordId)}`, searchResultSchema),
		version: (): Promise<VersionResponse> => request("/version", versionResponseSchema),
	};
}

export type ApiClient = ReturnType<typeof createApiClient>;
