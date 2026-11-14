import type { Pool } from "pg";
import { PgBoss } from "pg-boss";
import type { ImageLoader, ModelProvider } from "./provider.ts";
import { processExtraction, requestExtraction } from "./service.ts";

export const extractionQueue = "extraction";
const deadLetterQueue = "extraction-failed";

/**
 * pg-boss on the application's PostgreSQL. The run row is the source of truth for idempotency and
 * attempts; pg-boss only delivers the job and retries thrown (transient) errors with backoff.
 */
export async function startExtractionWorker(options: {
	connectionString: string;
	pool: Pool;
	provider: ModelProvider;
	loadImage: ImageLoader;
	maxAttempts: number;
}) {
	const boss = new PgBoss(options.connectionString);
	boss.on("error", (error) => console.error("pg-boss error", error));
	await boss.start();
	await boss.createQueue(deadLetterQueue);
	await boss.createQueue(extractionQueue, {
		retryLimit: options.maxAttempts - 1,
		retryDelay: 30,
		retryBackoff: true,
		deadLetter: deadLetterQueue,
	});
	await boss.work<{ runId: string }>(extractionQueue, async (jobs) => {
		for (const job of jobs)
			await processExtraction(options.pool, job.data.runId, {
				provider: options.provider,
				loadImage: options.loadImage,
			});
	});
	return {
		/** Creates (or finds) the run and queues it once; repeated calls never queue it twice. */
		async enqueue(imageId: string) {
			const run = await requestExtraction(options.pool, {
				imageId,
				provider: options.provider,
				maxAttempts: options.maxAttempts,
			});
			if (run.status === "queued")
				await boss.send(extractionQueue, { runId: run.id }, { singletonKey: run.id });
			return run;
		},
		stop: () => boss.stop(),
	};
}
