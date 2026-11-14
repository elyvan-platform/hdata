import {
	type CatalogErrorResponse,
	type CatalogRefreshResponse,
	type CatalogResponse,
	catalogErrorResponseSchema,
	catalogRefreshResponseSchema,
	catalogResponseSchema,
	type HealthResponse,
	healthResponseSchema,
	type ReadyResponse,
	readyResponseSchema,
	type VersionResponse,
	versionResponseSchema,
} from "@hdata/domain";
import type { ZodType } from "zod";

export class ApiError extends Error {
	readonly status: number;
	/** Present when the API answered a catalog refresh failure with its typed payload. */
	readonly catalogError: CatalogErrorResponse | undefined;

	constructor(message: string, status: number, catalogError?: CatalogErrorResponse) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.catalogError = catalogError;
	}

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
		version: (): Promise<VersionResponse> => request("/version", versionResponseSchema),
	};
}

export type ApiClient = ReturnType<typeof createApiClient>;
