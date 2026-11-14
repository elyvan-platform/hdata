import { readFileSync } from "node:fs";
import type { ReadyResponse, VersionResponse } from "@hdata/domain";
import { versionResponseSchema } from "@hdata/domain";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Database } from "../db/client.ts";

const packageSchema = z.object({ name: z.string(), version: z.string() });

function readPackage() {
	const raw: unknown = JSON.parse(
		readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
	);
	return packageSchema.parse(raw);
}

export type OperationalOptions = {
	database: Database;
	commit?: string | undefined;
};

export function registerOperationalRoutes(app: FastifyInstance, options: OperationalOptions) {
	const pkg = readPackage();
	const version: VersionResponse = versionResponseSchema.parse({
		name: pkg.name,
		version: pkg.version,
		commit: options.commit,
	});

	app.get("/health", async () => ({ status: "ok" as const }));

	app.get("/ready", async (request, reply) => {
		let database: "up" | "down" = "up";
		try {
			await options.database.ping();
		} catch (error) {
			request.log.error({ err: error }, "database readiness check failed");
			database = "down";
		}
		const body: ReadyResponse = {
			status: database === "up" ? "ready" : "not_ready",
			checks: { database },
		};
		return reply.code(database === "up" ? 200 : 503).send(body);
	});

	app.get("/version", async () => version);
}
