import { buildApp } from "./app.ts";
import { createCatalogService } from "./catalog/refresh-catalog.ts";
import { createDatabase } from "./db/client.ts";
import { createTokenAuthenticator, parseEditorialActors } from "./editorial/authenticator.ts";
import { parseEnv } from "./env/index.ts";

const env = parseEnv(process.env);
const { database, pool } = createDatabase(env.DATABASE_URL);
const catalog = createCatalogService({
	pool,
	url: env.DIGITARQ_CATALOG_URL,
	fondsReference: env.DIGITARQ_FONDS_REFERENCE,
	timeoutMs: env.DIGITARQ_TIMEOUT_MS,
});
const editorial = env.EDITORIAL_ACTORS
	? {
			pool,
			authenticate: createTokenAuthenticator(parseEditorialActors(env.EDITORIAL_ACTORS)),
		}
	: undefined;
const app = buildApp({ env, database, catalog, ...(editorial && { editorial }) });

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
