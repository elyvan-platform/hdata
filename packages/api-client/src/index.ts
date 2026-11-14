import {
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

	constructor(message: string, status: number) {
		super(message);
		this.name = "ApiError";
		this.status = status;
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
		version: (): Promise<VersionResponse> => request("/version", versionResponseSchema),
	};
}

export type ApiClient = ReturnType<typeof createApiClient>;
