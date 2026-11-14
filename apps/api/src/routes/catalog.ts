import { timingSafeEqual } from "node:crypto";
import type { CatalogErrorResponse } from "@hdata/domain";
import type { FastifyInstance } from "fastify";
import { CatalogError } from "../catalog/digitarq-adapter.ts";
import type { CatalogService } from "../catalog/refresh-catalog.ts";

export type CatalogRouteOptions = {
	catalog: CatalogService;
	refreshToken?: string | undefined;
};

function tokenMatches(expected: string, header: string | undefined): boolean {
	const given = Buffer.from(header?.replace(/^Bearer /, "") ?? "");
	const wanted = Buffer.from(expected);
	return given.length === wanted.length && timingSafeEqual(given, wanted);
}

/** Upstream refusals map to 502/504; the caller's own auth errors stay 401/403. */
function httpStatus(error: CatalogError): number {
	switch (error.code) {
		case "timeout":
			return 504;
		case "not_configured":
			return 503;
		case "storage_error":
			return 500;
		default:
			return 502;
	}
}

export function registerCatalogRoutes(app: FastifyInstance, options: CatalogRouteOptions) {
	app.get("/catalog", async () => options.catalog.list());

	app.post("/catalog/refresh", async (request, reply) => {
		if (!options.refreshToken)
			return reply.code(403).send({ error: "forbidden", message: "Catalog refresh is disabled" });
		if (!tokenMatches(options.refreshToken, request.headers.authorization))
			return reply.code(401).send({ error: "unauthorized", message: "Invalid or missing token" });
		try {
			return await options.catalog.refresh();
		} catch (error) {
			if (!(error instanceof CatalogError)) throw error;
			request.log.error({ err: error }, "catalog refresh failed");
			const body: CatalogErrorResponse = {
				error: error.code,
				message: error.message,
				status: await options.catalog.status(),
			};
			return reply.code(httpStatus(error)).send(body);
		}
	});
}
