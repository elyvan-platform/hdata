import { createHash } from "node:crypto";
import {
	type CatalogBook,
	type CatalogRefreshResponse,
	type CatalogResponse,
	type CatalogSnapshot,
	type CatalogStatus,
	catalogErrorCodeSchema,
	catalogReconciliationSchema,
} from "@hdata/domain";
import type { Pool, PoolClient } from "pg";
import { CatalogError, fetchCatalog } from "./digitarq-adapter.ts";
import { reconcileCatalog, type StoredBook } from "./reconcile-catalog.ts";

export type CatalogServiceOptions = {
	pool: Pool;
	/** Catalog endpoint; when absent, refreshing fails with `not_configured`. */
	url?: string | undefined;
	fondsReference: string;
	timeoutMs: number;
	fetch?: typeof fetch;
};

const SOURCE_NAME = "Digitarq";
const SOURCE_KIND = "catalog";

function contentHash(snapshot: CatalogSnapshot): string {
	const books = [...snapshot.books]
		.sort((a, b) => a.referenceCode.localeCompare(b.referenceCode))
		.map((b) => [b.referenceCode, b.title, b.shelfmark, b.folioCount, b.recordUrl, b.viewerUrl]);
	return createHash("sha256")
		.update(JSON.stringify([snapshot.fondsReference, snapshot.title, books]))
		.digest("hex");
}

async function inTransaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const result = await work(client);
		await client.query("COMMIT");
		return result;
	} catch (error) {
		await client.query("ROLLBACK").catch(() => {});
		throw error;
	} finally {
		client.release();
	}
}

const lock = (client: PoolClient, fonds: string) =>
	client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`catalog:${fonds}`]);

async function ensureSource(client: PoolClient, url: string | undefined): Promise<string> {
	const found = await client.query<{ id: string }>(
		"SELECT id FROM source WHERE name=$1 AND kind=$2 ORDER BY id LIMIT 1",
		[SOURCE_NAME, SOURCE_KIND],
	);
	if (found.rows[0]) return found.rows[0].id;
	const created = await client.query<{ id: string }>(
		"INSERT INTO source (name, kind, url) VALUES ($1,$2,$3) RETURNING id",
		[SOURCE_NAME, SOURCE_KIND, url ?? null],
	);
	return created.rows[0]?.id as string;
}

export function createCatalogService(options: CatalogServiceOptions) {
	const { pool, fondsReference } = options;

	async function sourceId(): Promise<string> {
		return inTransaction(pool, async (client) => {
			await lock(client, fondsReference);
			return ensureSource(client, options.url);
		});
	}

	async function recordFailure(source: string, error: CatalogError, startedAt: number) {
		await pool.query(
			"INSERT INTO catalog_refresh (source_id, outcome, error_code, message, duration_ms) VALUES ($1,'failure',$2,$3,$4)",
			[source, error.code, error.message, Date.now() - startedAt],
		);
	}

	async function promote(
		source: string,
		snapshot: CatalogSnapshot,
		startedAt: Date,
	): Promise<{ unchanged: boolean }> {
		const hash = contentHash(snapshot);
		return inTransaction(pool, async (client) => {
			await lock(client, fondsReference);
			const latest = await client.query<{ id: string; content_hash: string; fetched_at: Date }>(
				"SELECT id, content_hash, fetched_at FROM catalog_version WHERE source_id=$1 ORDER BY fetched_at DESC, id LIMIT 1",
				[source],
			);
			const last = latest.rows[0];
			// A slower, older response must not replace a version promoted meanwhile.
			if (last && last.fetched_at > startedAt)
				return { unchanged: true, versionId: last.id, superseded: true };
			const stored = await client.query<{
				reference_code: string;
				title: string;
				shelfmark: string | null;
				folio_count: number | null;
				source_url: string | null;
				viewer_url: string | null;
			}>(
				"SELECT external_id AS reference_code, title, shelfmark, folio_count, source_url, viewer_url FROM book WHERE source_id=$1 AND external_id IS NOT NULL",
				[source],
			);
			const storedBooks: StoredBook[] = stored.rows.map((r) => ({
				referenceCode: r.reference_code,
				title: r.title,
				shelfmark: r.shelfmark,
				folioCount: r.folio_count,
				recordUrl: r.source_url,
				viewerUrl: r.viewer_url,
			}));
			if (last?.content_hash === hash) {
				return { unchanged: true, versionId: last.id, superseded: false };
			}
			const reconciliation = reconcileCatalog(snapshot, storedBooks);
			const unit = await client.query<{ id: string }>(
				`INSERT INTO archival_unit (source_id, external_id, level, reference_code, title)
				 VALUES ($1,$2,'fonds',$2,$3)
				 ON CONFLICT (source_id, external_id) WHERE external_id IS NOT NULL
				 DO UPDATE SET title = EXCLUDED.title RETURNING id`,
				[source, snapshot.fondsReference, snapshot.title ?? snapshot.fondsReference],
			);
			for (const book of snapshot.books) {
				await client.query(
					`INSERT INTO book (source_id, external_id, archival_unit_id, reference_code, shelfmark, title, folio_count, source_url, viewer_url)
					 VALUES ($1,$2,$3,$2,$4,$5,$6,$7,$8)
					 ON CONFLICT (source_id, external_id) WHERE external_id IS NOT NULL
					 DO UPDATE SET title = EXCLUDED.title, shelfmark = EXCLUDED.shelfmark,
					   folio_count = EXCLUDED.folio_count, reference_code = EXCLUDED.reference_code,
					   source_url = COALESCE(EXCLUDED.source_url, book.source_url),
					   viewer_url = COALESCE(EXCLUDED.viewer_url, book.viewer_url)`,
					[
						source,
						book.referenceCode,
						unit.rows[0]?.id,
						book.shelfmark ?? null,
						book.title,
						book.folioCount ?? null,
						book.recordUrl ?? null,
						book.viewerUrl ?? null,
					],
				);
			}
			const version = await client.query<{ id: string }>(
				"INSERT INTO catalog_version (source_id, content_hash, book_count, viewer_count, reconciliation) VALUES ($1,$2,$3,$4,$5) RETURNING id",
				[
					source,
					hash,
					reconciliation.books,
					reconciliation.viewers,
					JSON.stringify(reconciliation),
				],
			);
			return { unchanged: false, versionId: version.rows[0]?.id as string, superseded: false };
		}).then(async (result) => {
			await pool.query(
				"INSERT INTO catalog_refresh (source_id, outcome, version_id, duration_ms) VALUES ($1,'success',$2,$3)",
				[source, result.versionId, Date.now() - startedAt.getTime()],
			);
			return { unchanged: result.unchanged };
		});
	}

	async function status(): Promise<CatalogStatus> {
		const source = await pool.query<{ id: string }>(
			"SELECT id FROM source WHERE name=$1 AND kind=$2 ORDER BY id LIMIT 1",
			[SOURCE_NAME, SOURCE_KIND],
		);
		const id = source.rows[0]?.id;
		if (!id) return { lastAttempt: null, lastSuccessAt: null, data: "none", reconciliation: null };
		const attempt = await pool.query<{
			outcome: "success" | "failure";
			attempted_at: Date;
			error_code: string | null;
			message: string | null;
		}>(
			"SELECT outcome, attempted_at, error_code, message FROM catalog_refresh WHERE source_id=$1 ORDER BY attempted_at DESC, id LIMIT 1",
			[id],
		);
		const version = await pool.query<{ fetched_at: Date; reconciliation: unknown }>(
			"SELECT fetched_at, reconciliation FROM catalog_version WHERE source_id=$1 ORDER BY fetched_at DESC, id LIMIT 1",
			[id],
		);
		const last = attempt.rows[0];
		const valid = version.rows[0];
		const lastSuccess = await pool.query<{ attempted_at: Date }>(
			"SELECT attempted_at FROM catalog_refresh WHERE source_id=$1 AND outcome='success' ORDER BY attempted_at DESC LIMIT 1",
			[id],
		);
		return {
			lastAttempt: last
				? {
						outcome: last.outcome,
						attemptedAt: last.attempted_at.toISOString(),
						...(last.error_code
							? { errorCode: catalogErrorCodeSchema.parse(last.error_code) }
							: {}),
						...(last.message ? { message: last.message } : {}),
					}
				: null,
			lastSuccessAt: lastSuccess.rows[0]?.attempted_at.toISOString() ?? null,
			data: !valid ? "none" : last?.outcome === "failure" ? "stored_copy" : "fresh",
			reconciliation: valid ? catalogReconciliationSchema.parse(valid.reconciliation) : null,
		};
	}

	return {
		status,
		async list(): Promise<CatalogResponse> {
			const current = await status();
			if (current.data === "none") return { status: current, books: [] };
			const rows = await pool.query<{
				reference_code: string;
				title: string;
				shelfmark: string | null;
				folio_count: number | null;
				source_url: string | null;
				viewer_url: string | null;
			}>(
				`SELECT b.reference_code, b.title, b.shelfmark, b.folio_count, b.source_url, b.viewer_url
				 FROM book b JOIN source s ON s.id=b.source_id
				 WHERE s.name=$1 AND s.kind=$2 AND b.external_id IS NOT NULL ORDER BY b.reference_code`,
				[SOURCE_NAME, SOURCE_KIND],
			);
			const books: CatalogBook[] = rows.rows.map((r) => ({
				referenceCode: r.reference_code,
				title: r.title,
				...(r.shelfmark ? { shelfmark: r.shelfmark } : {}),
				...(r.folio_count !== null ? { folioCount: r.folio_count } : {}),
				...(r.source_url ? { recordUrl: r.source_url } : {}),
				...(r.viewer_url ? { viewerUrl: r.viewer_url } : {}),
			}));
			return { status: current, books };
		},
		/** Fetches the catalog and promotes it; on failure the last valid catalog is kept and the error rethrown. */
		async refresh(): Promise<CatalogRefreshResponse> {
			const source = await sourceId();
			const started = new Date();
			try {
				if (!options.url)
					throw new CatalogError("not_configured", "DIGITARQ_CATALOG_URL is not configured");
				const snapshot = await fetchCatalog({
					url: options.url,
					fondsReference,
					timeoutMs: options.timeoutMs,
					...(options.fetch ? { fetch: options.fetch } : {}),
				});
				const { unchanged } = await promote(source, snapshot, started);
				return { status: await status(), bookCount: snapshot.books.length, unchanged };
			} catch (error) {
				const failure =
					error instanceof CatalogError
						? error
						: new CatalogError("storage_error", "Unexpected failure while storing the catalog", {
								cause: error,
							});
				await recordFailure(source, failure, started.getTime());
				throw failure;
			}
		},
	};
}

export type CatalogService = ReturnType<typeof createCatalogService>;
