import Fastify from "fastify";
import type { Pool } from "pg";
import type { CatalogService } from "./catalog/refresh-catalog.ts";
import type { Database } from "./db/client.ts";
import type { Authenticator } from "./editorial/types.ts";
import type { Env } from "./env/index.ts";
import { registerCatalogRoutes } from "./routes/catalog.ts";
import { registerOperationalRoutes } from "./routes/operational.ts";
import { registerReviewRoutes } from "./routes/review.ts";

export function buildApp(options: {
	env: Env;
	database: Database;
	catalog?: CatalogService;
	editorial?: { pool: Pool; authenticate: Authenticator };
}) {
	const app = Fastify({ logger: options.env.NODE_ENV !== "test" });
	registerOperationalRoutes(app, { database: options.database, commit: options.env.COMMIT_SHA });
	if (options.catalog)
		registerCatalogRoutes(app, {
			catalog: options.catalog,
			refreshToken: options.env.CATALOG_REFRESH_TOKEN,
		});
	if (options.editorial) registerReviewRoutes(app, options.editorial);
	app.addHook("onClose", async () => {
		await options.database.close();
	});
	return app;
}
