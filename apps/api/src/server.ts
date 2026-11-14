import { buildApp } from "./app.ts";
import { createCatalogService } from "./catalog/refresh-catalog.ts";
import { createDatabase } from "./db/client.ts";
import { parseEnv } from "./env/index.ts";

const env = parseEnv(process.env);
const { database, pool } = createDatabase(env.DATABASE_URL);
const catalog = createCatalogService({
	pool,
	url: env.DIGITARQ_CATALOG_URL,
	fondsReference: env.DIGITARQ_FONDS_REFERENCE,
	timeoutMs: env.DIGITARQ_TIMEOUT_MS,
});
const app = buildApp({ env, database, catalog });

try {
	await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
	app.log.error(error);
	process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.once(signal, () => {
		void app.close();
	});
}
