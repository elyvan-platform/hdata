import { open, readFile } from "node:fs/promises";
import { extractionBatchSchema } from "@hdata/domain";
import { createDatabase } from "../db/client.ts";
import { parseEnv } from "../env/index.ts";
import { previewBatch, runExtractionBatch } from "./batch.ts";
import { createAnthropicProvider, createUrlImageLoader } from "./provider.ts";

const [manifestFile, reportFile, mode] = process.argv.slice(2);
if (!manifestFile || !reportFile || (mode !== undefined && mode !== "--apply"))
	throw new Error("Usage: extraction:batch manifest.json report.json [--apply]");
const manifest = extractionBatchSchema.parse(JSON.parse(await readFile(manifestFile, "utf8")));
// Exclusive creation avoids overwriting either an input or a previous delivery.
const output = await open(reportFile, "wx", 0o600);
try {
	if (!mode) {
		await output.writeFile(
			`${JSON.stringify({ batchId: manifest.id, pages: previewBatch(manifest), index: [], reviewQueue: [], applied: false }, null, 2)}\n`,
		);
	} else {
		const env = parseEnv(process.env);
		if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required for --apply");
		const { pool } = createDatabase(env.DATABASE_URL);
		const lock = await pool.connect();
		try {
			// All batch CLI processes share one lock, so their concurrency limits cannot multiply.
			const acquired = await lock.query<{ acquired: boolean }>(
				"SELECT pg_try_advisory_lock(174111,11) AS acquired",
			);
			if (!acquired.rows[0]?.acquired) throw new Error("Another extraction batch is active");
			const result = await runExtractionBatch(pool, manifest, {
				provider: createAnthropicProvider({
					apiKey: env.ANTHROPIC_API_KEY,
					model: env.EXTRACTION_MODEL,
					timeoutMs: env.EXTRACTION_TIMEOUT_MS,
				}),
				loadImage: createUrlImageLoader({ timeoutMs: env.EXTRACTION_TIMEOUT_MS }),
			});
			await output.writeFile(`${JSON.stringify({ ...result, applied: true }, null, 2)}\n`);
		} finally {
			// Session advisory lock is released by destroying the connection, even after failure.
			lock.release(true);
			await pool.end();
		}
	}
} finally {
	await output.close();
}
