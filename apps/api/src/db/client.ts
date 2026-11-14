import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.ts";

export type Database = {
	/** Resolves when the database answers a trivial query; rejects otherwise. */
	ping(): Promise<void>;
	close(): Promise<void>;
};

export function createDatabase(connectionString: string) {
	const pool = new pg.Pool({
		connectionString,
		connectionTimeoutMillis: 2000,
		query_timeout: 2000,
	});
	const db = drizzle(pool, { schema });
	const database: Database = {
		async ping() {
			await pool.query("select 1");
		},
		close: () => pool.end(),
	};
	return { db, database };
}
