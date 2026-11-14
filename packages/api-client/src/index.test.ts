import { revisionContentSchema } from "@hdata/domain";
import { describe, expect, it } from "vitest";
import { ApiError, createApiClient } from "./index.ts";

function json(body: unknown, status = 200): typeof fetch {
	return async () => new Response(JSON.stringify(body), { status });
}

describe("api client", () => {
	it("parses a health response", async () => {
		const client = createApiClient({ baseUrl: "http://api/", fetch: json({ status: "ok" }) });
		expect(await client.health()).toEqual({ status: "ok" });
	});

	it("returns a not_ready payload on 503", async () => {
		const body = { status: "not_ready", checks: { database: "down" } };
		const client = createApiClient({ baseUrl: "http://api", fetch: json(body, 503) });
		expect(await client.ready()).toEqual(body);
	});

	it("throws an ApiError that flags auth errors", async () => {
		const client = createApiClient({ baseUrl: "http://api", fetch: json({}, 403) });
		const error = await client.version().catch((e: unknown) => e);
		expect(error).toBeInstanceOf(ApiError);
		expect(error instanceof ApiError && error.isAuthError).toBe(true);
	});

	it("rejects an invalid payload", async () => {
		const client = createApiClient({ baseUrl: "http://api", fetch: json({ nope: 1 }) });
		await expect(client.health()).rejects.toThrow();
	});

	it("sends the editorial token and exposes a typed conflict", async () => {
		let auth: string | null = null;
		const conflict = {
			error: "conflict",
			message: "Concurrent edit touches the same fields",
			conflicts: [{ field: "folio", base: "1", mine: "2", theirs: "3" }],
		};
		const client = createApiClient({
			baseUrl: "http://api",
			fetch: async (_url, init) => {
				auth = new Headers(init?.headers).get("authorization");
				return new Response(JSON.stringify(conflict), { status: 409 });
			},
		});
		const id = "00000000-0000-4000-8000-000000000000";
		const error = await client
			.review("secret-token")
			.edit(id, { baseRevisionId: id, content: revisionContentSchema.parse({}) })
			.catch((e: unknown) => e);
		expect(auth).toBe("Bearer secret-token");
		expect(error instanceof ApiError && error.editorialError?.error).toBe("conflict");
		expect(error instanceof ApiError && error.isAuthError).toBe(false);
	});
});
