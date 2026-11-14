import { PgBoss } from "pg-boss";
import { createDatabase } from "../db/client.ts";
import { parseEnv } from "../env/index.ts";
import { createAnthropicProvider } from "./provider.ts";
import { requestExtraction } from "./service.ts";
import { extractionQueue } from "./worker.ts";

/** Usage: pnpm extraction:enqueue <image-uuid>. The running API process picks the job up. */
const imageId = process.argv[2];
if (!imageId) {
	console.error("Usage: pnpm extraction:enqueue <image-uuid>");
	process.exit(2);
}
const env = parseEnv(process.env);
if (!env.ANTHROPIC_API_KEY) {
	console.error("ANTHROPIC_API_KEY is required");
	process.exit(2);
}
const { pool } = createDatabase(env.DATABASE_URL);
const boss = new PgBoss(env.DATABASE_URL);
try {
	await boss.start();
	const run = await requestExtraction(pool, {
		imageId,
		provider: createAnthropicProvider({
			apiKey: env.ANTHROPIC_API_KEY,
			model: env.EXTRACTION_MODEL,
			timeoutMs: env.EXTRACTION_TIMEOUT_MS,
		}),
		maxAttempts: env.EXTRACTION_MAX_ATTEMPTS,
	});
	if (run.status === "queued")
		await boss.send(extractionQueue, { runId: run.id }, { singletonKey: run.id });
	console.log(JSON.stringify(run));
} finally {
	await boss.stop();
	await pool.end();
}
