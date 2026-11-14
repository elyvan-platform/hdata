import { bookExtractionRequestSchema, bookExtractionStatusSchema } from "@hdata/domain";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { discoverBookPages, registerBookPage } from "../extraction/digitarq-book.ts";
import type { startExtractionWorker } from "../extraction/worker.ts";
import { tokenMatches } from "./catalog.ts";

export type BookWorker = Awaited<ReturnType<typeof startExtractionWorker>> | undefined;
export function registerBookExtractionRoutes(
	app: FastifyInstance,
	options: {
		pool: Pool;
		token?: string | undefined;
		worker?: Awaited<ReturnType<typeof startExtractionWorker>> | undefined;
	},
) {
	app.post("/catalog/extraction", async (request, reply) => {
		reply.header("cache-control", "no-store");
		if (!options.token) return reply.code(403).send({ error: "disabled" });
		if (!tokenMatches(options.token, request.headers.authorization))
			return reply.code(401).send({ error: "unauthorized" });
		const parsed = bookExtractionRequestSchema.safeParse(request.body);
		if (!parsed.success) return reply.code(400).send({ error: "invalid_range" });
		const { book, first, limit, enqueue, rightsEvidence } = parsed.data;
		const found = await options.pool.query<{
			id: string;
			source_id: string;
			viewer_url: string;
			rights_status: string;
		}>(
			`SELECT b.id,b.source_id,b.viewer_url,s.rights_status FROM book b JOIN source s ON s.id=b.source_id
			 WHERE b.reference_code=$1 AND s.name='Digitarq' AND s.kind='catalog' AND b.viewer_url IS NOT NULL`,
			[book],
		);
		const volume = found.rows[0];
		if (!volume || found.rows.length !== 1)
			return reply.code(404).send({ error: "book_unavailable" });
		const worker = options.worker;
		if (enqueue && !worker) return reply.code(503).send({ error: "worker_disabled" });
		if (
			enqueue &&
			volume.rights_status !== "authorized" &&
			(volume.rights_status !== "unknown" || !rightsEvidence)
		)
			return reply.code(409).send({ error: "rights_unknown" });
		let discovered: Awaited<ReturnType<typeof discoverBookPages>>;
		try {
			discovered = await discoverBookPages(volume.viewer_url, first - 1, limit);
		} catch (error) {
			request.log.error({ err: error }, "Digitarq page discovery failed");
			return reply.code(502).send({ error: "digitarq_unavailable" });
		}
		if (enqueue && worker) {
			if (discovered.pages.length && volume.rights_status === "unknown" && rightsEvidence) {
				const decision = await options.pool.query(
					`UPDATE source SET rights_status='authorized',
					 citation=concat_ws(E'\\n', citation, $2::text)
					 WHERE id=$1 AND rights_status='unknown'`,
					[volume.source_id, "External image processing authorization: " + rightsEvidence],
				);
				if (!decision.rowCount) return reply.code(409).send({ error: "rights_unknown" });
			}
			for (const page of discovered.pages) {
				const imageId = await registerBookPage(options.pool, volume, page);
				await worker.enqueue(imageId);
			}
		}
		const runs = await options.pool.query<{
			external_id: string;
			status: string;
			error_code: string | null;
		}>(
			`SELECT DISTINCT ON (i.external_id) i.external_id,r.status,r.error_code
			 FROM image_ref i JOIN extraction_run r ON r.image_id=i.id
			 WHERE i.book_id=$1 AND i.external_id=ANY($2::text[])
			 ORDER BY i.external_id,r.created_at DESC,r.id DESC`,
			[volume.id, discovered.pages.map((page) => page.externalId)],
		);
		const byPage = new Map(runs.rows.map((run) => [run.external_id, run]));
		return bookExtractionStatusSchema.parse({
			total: discovered.total,
			pages: discovered.pages.map((page) => {
				const run = byPage.get(page.externalId);
				return {
					page: page.sequence,
					viewerUrl: page.viewerUrl,
					status: run?.status ?? "not_queued",
					error: run?.error_code ?? null,
				};
			}),
		});
	});
}
