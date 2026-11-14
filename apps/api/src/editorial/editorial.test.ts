import { PGlite } from "@electric-sql/pglite";
import { revisionContentSchema } from "@hdata/domain";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { importRecord } from "../archive/import-record.ts";
import { parseEnv } from "../env/index.ts";
import { createTokenAuthenticator, parseEditorialActors } from "./authenticator.ts";
import { decide, editRevision, getFiche, listQueue } from "./service.ts";
import { type Actor, EditorialFailure } from "./types.ts";

const editor: Actor = { id: "ana", role: "editor" };
const other: Actor = { id: "rui", role: "editor" };
const reviewer: Actor = { id: "rita", role: "reviewer" };
const publisher: Actor = { id: "paulo", role: "publisher" };

let db: PGlite;
let pool: Pool;
let sourceId: string;
let bookId: string;
let imageId: string;
let n = 0;

/** One connection: a mutex on connect/release stands in for PostgreSQL row locks. */
function fakePool(client: PGlite): Pool {
	let tail: Promise<void> = Promise.resolve();
	return {
		connect: async () => {
			let release = () => {};
			const previous = tail;
			tail = new Promise<void>((resolve) => {
				release = resolve;
			});
			await previous;
			return { query: (q: string, p?: unknown[]) => client.query(q, p), release };
		},
		query: (q: string, p?: unknown[]) => client.query(q, p),
	} as unknown as Pool;
}

beforeAll(async () => {
	db = await PGlite.create();
	await migrate(drizzle(db), { migrationsFolder: "./drizzle" });
	pool = fakePool(db);
	const source = await db.query<{ id: string }>(
		"INSERT INTO source (name,kind,rights_status) VALUES ('Arquivo','primary','public-domain') RETURNING id",
	);
	sourceId = source.rows[0]?.id ?? "";
	const unit = await db.query<{ id: string }>(
		"INSERT INTO archival_unit (source_id,level,title) VALUES ($1,'fonds','Fundo') RETURNING id",
		[sourceId],
	);
	const book = await db.query<{ id: string }>(
		"INSERT INTO book (source_id,archival_unit_id,title,reference_code,viewer_url) VALUES ($1,$2,'Livro','PT/1','https://example.org/v/1') RETURNING id",
		[sourceId, unit.rows[0]?.id],
	);
	bookId = book.rows[0]?.id ?? "";
	const image = await db.query<{ id: string }>(
		"INSERT INTO image_ref (source_id,book_id,sequence,url,rights_status) VALUES ($1,$2,1,'https://example.org/i/1','public-domain') RETURNING id",
		[sourceId, bookId],
	);
	imageId = image.rows[0]?.id ?? "";
});
afterAll(() => db.close());

async function seed(extra: Record<string, unknown> = {}) {
	n += 1;
	const { recordId, revisionId } = await importRecord(pool, {
		sourceId,
		bookId,
		externalId: `rec-${n}`,
		revision: {
			recordType: "baptism",
			originalText: "texto automático",
			folio: "1",
			provenance: { sourceId, method: "import", locator: "f. 1" },
			participants: [{ role: "child", nameAsWritten: "João", position: 0 }],
			images: [{ imageId }],
			...extra,
		},
	});
	return { recordId, revisionId };
}

const content = (over: Record<string, unknown> = {}) =>
	revisionContentSchema.parse({
		date: null,
		folio: "1",
		placeAsWritten: null,
		normalizedPlace: null,
		originalText: "texto automático",
		marginalNotes: null,
		participants: [{ role: "child", nameAsWritten: "João", legibility: "legible", position: 0 }],
		images: [{ imageId }],
		...over,
	});

async function code(promise: Promise<unknown>) {
	try {
		await promise;
	} catch (error) {
		if (error instanceof EditorialFailure) return error;
		throw error;
	}
	throw new Error("expected EditorialFailure");
}

describe("permissions", () => {
	let ids: { recordId: string; revisionId: string };
	beforeEach(async () => {
		ids = await seed();
	});

	it("lets only editors edit and submit", async () => {
		const request = { baseRevisionId: ids.revisionId, content: content({ folio: "2" }) };
		expect((await code(editRevision(pool, publisher, ids.recordId, request))).code).toBe(
			"forbidden",
		);
		const { revision } = await editRevision(pool, editor, ids.recordId, request);
		expect(
			(await code(decide(pool, publisher, ids.recordId, "submit", { revisionId: revision.id })))
				.code,
		).toBe("forbidden");
		const submitted = await decide(pool, editor, ids.recordId, "submit", {
			revisionId: revision.id,
		});
		expect(submitted.status).toBe("in_review");
	});

	it("lets only reviewers validate or reject", async () => {
		await decide(pool, editor, ids.recordId, "submit", { revisionId: ids.revisionId });
		for (const decision of ["validate", "reject"] as const)
			expect(
				(
					await code(
						decide(pool, editor, ids.recordId, decision, { revisionId: ids.revisionId, note: "x" }),
					)
				).code,
			).toBe("forbidden");
		const validated = await decide(pool, reviewer, ids.recordId, "validate", {
			revisionId: ids.revisionId,
		});
		expect(validated.status).toBe("validated");
	});

	it("lets only publishers publish, and only validated revisions", async () => {
		await decide(pool, editor, ids.recordId, "submit", { revisionId: ids.revisionId });
		expect(
			(await code(decide(pool, publisher, ids.recordId, "publish", { revisionId: ids.revisionId })))
				.code,
		).toBe("invalid_transition");
		await decide(pool, reviewer, ids.recordId, "validate", { revisionId: ids.revisionId });
		expect(
			(await code(decide(pool, reviewer, ids.recordId, "publish", { revisionId: ids.revisionId })))
				.code,
		).toBe("forbidden");
		const published = await decide(pool, publisher, ids.recordId, "publish", {
			revisionId: ids.revisionId,
		});
		expect(published.status).toBe("published");
	});

	it("refuses publication when rights are unknown", async () => {
		const unknown = await db.query<{ id: string }>(
			"INSERT INTO source (name,kind) VALUES ('Desconhecida','secondary') RETURNING id",
		);
		const sid = unknown.rows[0]?.id;
		n += 1;
		const { recordId, revisionId } = await importRecord(pool, {
			sourceId: sid,
			bookId,
			externalId: `rights-${n}`,
			revision: { recordType: "baptism", provenance: { sourceId: sid, method: "import" } },
		});
		await decide(pool, editor, recordId, "submit", { revisionId });
		await decide(pool, reviewer, recordId, "validate", { revisionId });
		expect((await code(decide(pool, publisher, recordId, "publish", { revisionId }))).code).toBe(
			"rights_unknown",
		);
	});

	it("keeps author, role, status change and date for every change", async () => {
		const { revision } = await editRevision(pool, editor, ids.recordId, {
			baseRevisionId: ids.revisionId,
			content: content({ originalText: "leitura humana" }),
			note: "primeira leitura",
		});
		await decide(pool, editor, ids.recordId, "submit", { revisionId: revision.id });
		await decide(pool, reviewer, ids.recordId, "reject", {
			revisionId: revision.id,
			note: "ilegível",
		});
		const fiche = await getFiche(pool, reviewer, ids.recordId);
		expect(fiche.current.status).toBe("rejected");
		expect(fiche.current.recordedBy).toBe("ana");
		expect(
			fiche.current.events.map((e) => [
				e.action,
				e.actorId,
				e.actorRole,
				e.fromStatus,
				e.toStatus,
				e.note,
			]),
		).toEqual([
			["edited", "ana", "editor", "draft", "draft", "primeira leitura"],
			["submit", "ana", "editor", "draft", "in_review", null],
			["reject", "rita", "reviewer", "in_review", "rejected", "ilegível"],
		]);
		expect(Number.isNaN(Date.parse(fiche.current.events[0]?.createdAt ?? ""))).toBe(false);
		await expect(db.query("DELETE FROM revision_event")).rejects.toThrow();
		await expect(db.query("UPDATE revision_event SET note='x'")).rejects.toThrow();
	});
});

describe("fiche and queue", () => {
	it("separates human reading, automatic proposal and secondary index and shows the document", async () => {
		const ids = await seed();
		await db.query(
			"INSERT INTO historical_entry (source_id,external_id,content_hash,payload) VALUES ($1,$2,'h',$3)",
			[
				sourceId,
				`rec-${n}`,
				JSON.stringify({
					sourceId,
					citation: "Índice secundário",
					reuseEvidence: "x",
					entry: {
						externalId: `rec-${n}`,
						recordType: "baptism",
						kind: "index",
						text: "João Silva",
						confidence: "low",
						raw: {},
					},
				}),
			],
		);
		const before = await getFiche(pool, editor, ids.recordId);
		expect(before.humanReading).toBeNull();
		expect(before.automaticProposal?.content.originalText).toBe("texto automático");
		expect(before.secondaryIndex).toMatchObject([
			{ citation: "Índice secundário", kind: "index", text: "João Silva" },
		]);
		expect(before.reference).toMatchObject({
			viewerUrl: "https://example.org/v/1",
			locator: "f. 1",
			images: [{ url: "https://example.org/i/1" }],
		});
		await editRevision(pool, editor, ids.recordId, {
			baseRevisionId: ids.revisionId,
			content: content({ originalText: "humano" }),
		});
		const after = await getFiche(pool, editor, ids.recordId);
		expect(after.humanReading?.content.originalText).toBe("humano");
		expect(after.automaticProposal?.content.originalText).toBe("texto automático");
		expect(after.history).toHaveLength(2);
		expect(after.permissions).toEqual(["view", "edit", "submit"]);
		const queue = await listQueue(pool, editor);
		expect(queue.find((i) => i.recordId === ids.recordId)).toMatchObject({
			status: "draft",
			method: "manual",
		});
	});
});

describe("conflicts and concurrent edits", () => {
	it("merges non-overlapping edits made from the same base", async () => {
		const ids = await seed();
		await editRevision(pool, editor, ids.recordId, {
			baseRevisionId: ids.revisionId,
			content: content({ folio: "9" }),
		});
		const result = await editRevision(pool, other, ids.recordId, {
			baseRevisionId: ids.revisionId,
			content: content({ marginalNotes: "nota" }),
		});
		expect(result.merged).toBe(true);
		expect(result.revision.content).toMatchObject({ folio: "9", marginalNotes: "nota" });
		expect(result.revision.events.map((e) => e.action)).toEqual(["merged"]);
	});

	it("refuses overlapping edits, reports the fields and writes nothing", async () => {
		const ids = await seed();
		await editRevision(pool, editor, ids.recordId, {
			baseRevisionId: ids.revisionId,
			content: content({ originalText: "A" }),
		});
		const failure = await code(
			editRevision(pool, other, ids.recordId, {
				baseRevisionId: ids.revisionId,
				content: content({ originalText: "B" }),
			}),
		);
		expect(failure.code).toBe("conflict");
		expect(failure.details.conflicts).toEqual([
			{ field: "originalText", base: "texto automático", mine: "B", theirs: "A" },
		]);
		const current = failure.details.current as { id: string; content: { originalText: string } };
		expect((await getFiche(pool, editor, ids.recordId)).history).toHaveLength(2);
		// Resolution: rebase on the current revision and resubmit the chosen text.
		const resolved = await editRevision(pool, other, ids.recordId, {
			baseRevisionId: current.id,
			content: content({ originalText: "A+B" }),
		});
		expect(resolved.merged).toBe(false);
		expect(resolved.revision.content.originalText).toBe("A+B");
	});

	it("serialises simultaneous edits from the same base", async () => {
		const ids = await seed();
		const results = await Promise.allSettled([
			editRevision(pool, editor, ids.recordId, {
				baseRevisionId: ids.revisionId,
				content: content({ originalText: "A" }),
			}),
			editRevision(pool, other, ids.recordId, {
				baseRevisionId: ids.revisionId,
				content: content({ originalText: "B" }),
			}),
		]);
		expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
		const rejected = results.find((r) => r.status === "rejected");
		expect(rejected?.status === "rejected" && rejected.reason).toMatchObject({ code: "conflict" });
		expect(
			(await getFiche(pool, editor, ids.recordId)).history.map((r) => r.revisionNumber),
		).toEqual([2, 1]);
	});

	it("rejects a decision on a revision that is no longer the latest", async () => {
		const ids = await seed();
		await editRevision(pool, editor, ids.recordId, {
			baseRevisionId: ids.revisionId,
			content: content({ folio: "3" }),
		});
		expect(
			(await code(decide(pool, editor, ids.recordId, "submit", { revisionId: ids.revisionId })))
				.code,
		).toBe("stale_revision");
		const concurrent = await Promise.allSettled([
			decide(pool, reviewer, ids.recordId, "reject", {
				revisionId: (await getFiche(pool, reviewer, ids.recordId)).current.id,
				note: "a",
			}),
			decide(pool, editor, ids.recordId, "submit", {
				revisionId: (await getFiche(pool, reviewer, ids.recordId)).current.id,
			}),
		]);
		expect(concurrent.filter((r) => r.status === "fulfilled")).toHaveLength(1);
	});

	it("rejects no-op edits and invalid content", async () => {
		const ids = await seed();
		expect(
			(
				await code(
					editRevision(pool, editor, ids.recordId, {
						baseRevisionId: ids.revisionId,
						content: content(),
					}),
				)
			).code,
		).toBe("no_changes");
		const bad = content({ images: [{ imageId: "00000000-0000-4000-8000-000000000000" }] });
		expect(
			(
				await code(
					editRevision(pool, editor, ids.recordId, {
						baseRevisionId: ids.revisionId,
						content: bad,
					}),
				)
			).code,
		).toBe("invalid_request");
	});
});

describe("HTTP", () => {
	it("answers 401 without credentials, 403 without permission and 409 on conflict", async () => {
		const ids = await seed();
		const actors = parseEditorialActors(
			JSON.stringify([
				{ token: "editor-token-0123456", id: "ana", role: "editor" },
				{ token: "publisher-token-01234", id: "paulo", role: "publisher" },
			]),
		);
		const app = buildApp({
			env: parseEnv({ NODE_ENV: "test" }),
			database: { ping: async () => {}, close: async () => {} },
			editorial: { pool, authenticate: createTokenAuthenticator(actors) },
		});
		const url = `/review/records/${ids.recordId}`;
		expect((await app.inject(url)).statusCode).toBe(401);
		expect(
			(await app.inject({ url, headers: { authorization: "Bearer wrong-token-000000000" } }))
				.statusCode,
		).toBe(401);
		const asEditor = { authorization: "Bearer editor-token-0123456" };
		const asPublisher = { authorization: "Bearer publisher-token-01234" };
		expect((await app.inject({ url, headers: asEditor })).statusCode).toBe(200);
		expect(
			(
				await app.inject({
					method: "POST",
					url: `${url}/revisions`,
					headers: asPublisher,
					payload: { baseRevisionId: ids.revisionId, content: content({ folio: "5" }) },
				})
			).statusCode,
		).toBe(403);
		expect(
			(
				await app.inject({
					method: "POST",
					url: `${url}/revisions`,
					headers: asEditor,
					payload: { baseRevisionId: "nope" },
				})
			).statusCode,
		).toBe(422);
		const created = await app.inject({
			method: "POST",
			url: `${url}/revisions`,
			headers: asEditor,
			payload: { baseRevisionId: ids.revisionId, content: content({ folio: "5" }) },
		});
		expect(created.statusCode).toBe(201);
		const stale = await app.inject({
			method: "POST",
			url: `${url}/submit`,
			headers: asEditor,
			payload: { revisionId: ids.revisionId },
		});
		expect(stale.statusCode).toBe(409);
		expect(stale.json().error).toBe("stale_revision");
		expect(
			(await app.inject({ url: "/review/queue", headers: asEditor })).json().items.length,
		).toBeGreaterThan(0);
		await app.close();
	});
});
