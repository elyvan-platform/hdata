import { PgBoss } from "pg-boss";
import { z } from "zod";
import { createDatabase } from "../db/client.ts";
import { parseEnv } from "../env/index.ts";
import { discoverBookPages, registerBookPage } from "./digitarq-book.ts";
import { createOpenRouterProvider } from "./provider.ts";
import { requestExtraction } from "./service.ts";
import { extractionQueue } from "./worker.ts";

const [reference, rawOffset = "0", rawLimit = "5", mode, ...extra] = process.argv.slice(2);
if (!reference || (mode !== undefined && mode !== "--apply") || extra.length)
	throw new Error("Usage: extraction:book <book-reference> [offset] [limit 1–20] [--apply]");
const offset = z.coerce.number().int().min(0).max(100_000).parse(rawOffset);
const limit = z.coerce.number().int().min(1).max(20).parse(rawLimit);
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must identify the target database");
const env = parseEnv(process.env);
const { pool } = createDatabase(env.DATABASE_URL);

try {
	const result = await pool.query<{
		id: string;
		source_id: string;
		viewer_url: string;
		rights_status: string;
	}>(
		`SELECT b.id,b.source_id,b.viewer_url,s.rights_status FROM book b
		 JOIN source s ON s.id=b.source_id
		 WHERE b.reference_code=$1 AND s.name='Digitarq' AND s.kind='catalog'
		   AND b.viewer_url IS NOT NULL`,
		[reference],
	);
	const book = result.rows[0];
	if (result.rowCount !== 1 || !book)
		throw new Error("Expected one catalogued Digitarq book with images");
	const discovered = await discoverBookPages(book.viewer_url, offset, limit);
	if (!mode) {
		console.log(JSON.stringify({ ...discovered, applied: false }, null, 2));
	} else {
		if (book.rights_status !== "authorized")
			throw new Error("The catalog source must authorize external image processing");
		if (!env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is required");
		const provider = createOpenRouterProvider({
			apiKey: env.OPENROUTER_API_KEY,
			model: env.EXTRACTION_MODEL,
			timeoutMs: env.EXTRACTION_TIMEOUT_MS,
		});
		const boss = new PgBoss(env.DATABASE_URL);
		try {
			await boss.start();
			for (const page of discovered.pages) {
				const imageId = await registerBookPage(pool, book, page);
				const run = await requestExtraction(pool, {
					imageId,
					provider,
					maxAttempts: env.EXTRACTION_MAX_ATTEMPTS,
				});
				if (run.status === "queued")
					await boss.send(extractionQueue, { runId: run.id }, { singletonKey: run.id });
				console.log(
					JSON.stringify({
						page: page.sequence,
						imageId,
						runId: run.id,
						status: run.status,
						viewerUrl: page.viewerUrl,
					}),
				);
			}
		} finally {
			await boss.stop();
		}
	}
} finally {
	await pool.end();
}
