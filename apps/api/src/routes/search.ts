import { searchQuerySchema } from "@hdata/domain";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { getCoverage, getPublishedRecord, searchRecords } from "../search/service.ts";

export type SearchRouteOptions = { pool: Pool };

function invalid(error: z.ZodError) {
	return { error: "invalid_request", message: error.issues.map((i) => i.message).join("; ") };
}

/** Public consultation of published seats only; a technical failure is a 5xx, never an empty list. */
export function registerSearchRoutes(app: FastifyInstance, options: SearchRouteOptions) {
	app.get("/search", async (request, reply) => {
		const query = searchQuerySchema.safeParse(request.query);
		if (!query.success) return reply.code(400).send(invalid(query.error));
		return searchRecords(options.pool, query.data);
	});
	app.get("/search/coverage", async () => getCoverage(options.pool));
	app.get("/records/:recordId", async (request, reply) => {
		const params = z.object({ recordId: z.uuid() }).safeParse(request.params);
		if (!params.success) return reply.code(400).send(invalid(params.error));
		const record = await getPublishedRecord(options.pool, params.data.recordId);
		if (!record) return reply.code(404).send({ error: "not_found", message: "Record not found" });
		return record;
	});
}
