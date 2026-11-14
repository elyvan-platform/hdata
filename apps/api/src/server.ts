import { buildApp } from "./app.ts";
import { createDatabase } from "./db/client.ts";
import { parseEnv } from "./env/index.ts";

const env = parseEnv(process.env);
const { database } = createDatabase(env.DATABASE_URL);
const app = buildApp({ env, database });

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
