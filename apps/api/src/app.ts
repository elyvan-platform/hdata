import Fastify from "fastify";
import type { CatalogService } from "./catalog/refresh-catalog.ts";
import type { Database } from "./db/client.ts";
import type { Env } from "./env/index.ts";
import { registerCatalogRoutes } from "./routes/catalog.ts";
import { registerOperationalRoutes } from "./routes/operational.ts";

export function buildApp(options: { env: Env; database: Database; catalog?: CatalogService }) {
	const app = Fastify({ logger: options.env.NODE_ENV !== "test" });
	registerOperationalRoutes(app, { database: options.database, commit: options.env.COMMIT_SHA });
	if (options.catalog)
		registerCatalogRoutes(app, {
			catalog: options.catalog,
			refreshToken: options.env.CATALOG_REFRESH_TOKEN,
		});
	app.addHook("onClose", async () => {
		await options.database.close();
	});
	return app;
}
