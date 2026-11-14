import Fastify from "fastify";
import type { Database } from "./db/client.ts";
import type { Env } from "./env/index.ts";
import { registerOperationalRoutes } from "./routes/operational.ts";

export function buildApp(options: { env: Env; database: Database }) {
	const app = Fastify({ logger: options.env.NODE_ENV !== "test" });
	registerOperationalRoutes(app, { database: options.database, commit: options.env.COMMIT_SHA });
	app.addHook("onClose", async () => {
		await options.database.close();
	});
	return app;
}
