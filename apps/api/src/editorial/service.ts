import { createHash } from "node:crypto";
import {
	can,
	type DocumentReference,
	decisionTransitions,
	type EditorialAction,
	type EditorialDecision,
	type EditRevisionRequest,
	editorialActions,
	type Fiche,
	mergeRevisionContent,
	type ReviewQueueItem,
	type RevisionContent,
	type RevisionView,
	revisionContentSchema,
	sameValue,
	validationStatusSchema,
} from "@hdata/domain";
import type { Pool, PoolClient } from "pg";
import { canonical } from "../archive/import-record.ts";
import { type Actor, EditorialFailure } from "./types.ts";

type Queryable = Pick<PoolClient, "query">;

function authorize(actor: Actor, action: EditorialAction) {
	if (!can(actor.role, action))
		throw new EditorialFailure("forbidden", `Role ${actor.role} may not ${action}`);
}

const iso = (value: unknown): string =>
	value instanceof Date ? value.toISOString() : String(value);

type RevisionRow = {
	id: string;
	record_id: string;
	revision_number: number;
	status: string;
	method: "manual" | "import";
	recorded_by: string | null;
	recorded_at: unknown;
	supersedes_revision_id: string | null;
	source_id: string;
	locator: string | null;
	date: unknown;
	folio: string | null;
	place_as_written: string | null;
	normalized_place: string | null;
	original_text: string | null;
	marginal_notes: string | null;
};

async function loadRevisions(db: Queryable, recordId: string): Promise<RevisionView[]> {
	const revisions = await db.query<RevisionRow>(
		"SELECT * FROM record_revision WHERE record_id=$1 ORDER BY revision_number DESC",
		[recordId],
	);
	const ids = revisions.rows.map((row) => row.id);
	const [participants, images, events] = await Promise.all([
		db.query(
			"SELECT revision_id, role, name_as_written, normalized_name, legibility, role_as_written, notes, position FROM participant WHERE revision_id = ANY($1::uuid[]) ORDER BY position",
			[ids],
		),
		db.query(
			"SELECT revision_id, image_id, region FROM record_revision_image WHERE revision_id = ANY($1::uuid[]) ORDER BY image_id",
			[ids],
		),
		db.query("SELECT * FROM revision_event WHERE record_id=$1 ORDER BY created_at, id", [recordId]),
	]);
	return revisions.rows.map((row) => ({
		id: row.id,
		revisionNumber: row.revision_number,
		status: validationStatusSchema.parse(row.status),
		method: row.method,
		recordedBy: row.recorded_by,
		recordedAt: iso(row.recorded_at),
		supersedesRevisionId: row.supersedes_revision_id,
		content: revisionContentSchema.parse({
			date: row.date ?? null,
			folio: row.folio,
			placeAsWritten: row.place_as_written,
			normalizedPlace: row.normalized_place,
			originalText: row.original_text,
			marginalNotes: row.marginal_notes,
			participants: participants.rows
				.filter((p) => p.revision_id === row.id)
				.map((p) => ({
					role: p.role,
					nameAsWritten: p.name_as_written,
					normalizedName: p.normalized_name ?? undefined,
					legibility: p.legibility,
					roleAsWritten: p.role_as_written ?? undefined,
					notes: p.notes ?? undefined,
					position: p.position,
				})),
			images: images.rows
				.filter((i) => i.revision_id === row.id)
				.map((i) => ({ imageId: i.image_id, region: i.region ?? undefined })),
		}),
		events: events.rows
			.filter((e) => e.revision_id === row.id)
			.map((e) => ({
				id: e.id,
				revisionId: e.revision_id,
				action: e.action,
				actorId: e.actor_id,
				actorRole: e.actor_role,
				fromStatus: e.from_status,
				toStatus: e.to_status,
				note: e.note,
				createdAt: iso(e.created_at),
			})),
	}));
}

async function loadReference(
	db: Queryable,
	bookId: string,
	revisionId: string,
	locator: string | null,
): Promise<DocumentReference> {
	const book = await db.query(
		"SELECT title, reference_code, viewer_url, source_url FROM book WHERE id=$1",
		[bookId],
	);
	const images = await db.query(
		"SELECT i.id, i.folio, i.side, i.url, l.region FROM record_revision_image l JOIN image_ref i ON i.id = l.image_id WHERE l.revision_id=$1 ORDER BY i.sequence",
		[revisionId],
	);
	const row = book.rows[0];
	return {
		bookTitle: row?.title ?? "",
		bookReference: row?.reference_code ?? null,
		viewerUrl: row?.viewer_url ?? null,
		sourceUrl: row?.source_url ?? null,
		locator,
		images: images.rows.map((i) => ({
			id: i.id,
			folio: i.folio,
			side: i.side,
			url: i.url,
			region: i.region ?? null,
		})),
	};
}

/** Latest revision of each record still awaiting an editorial outcome, oldest first. */
export async function listQueue(
	pool: Pool,
	actor: Actor,
	statuses: readonly string[] = ["draft", "in_review"],
): Promise<ReviewQueueItem[]> {
	authorize(actor, "view");
	const result = await pool.query(
		`SELECT r.id AS record_id, r.external_id, r.record_type, r.book_id, v.id AS revision_id, v.revision_number, v.status, v.method, v.recorded_by, v.recorded_at, v.locator
		 FROM archive_record r
		 JOIN record_revision v ON v.record_id = r.id AND v.revision_number = (SELECT max(revision_number) FROM record_revision WHERE record_id = r.id)
		 WHERE v.status::text = ANY($1::text[])
		 ORDER BY v.recorded_at, r.id`,
		[statuses],
	);
	const items: ReviewQueueItem[] = [];
	for (const row of result.rows)
		items.push({
			recordId: row.record_id,
			externalId: row.external_id,
			recordType: row.record_type,
			revisionId: row.revision_id,
			revisionNumber: row.revision_number,
			status: validationStatusSchema.parse(row.status),
			method: row.method,
			recordedBy: row.recorded_by,
			recordedAt: iso(row.recorded_at),
			reference: await loadReference(pool, row.book_id, row.revision_id, row.locator),
		});
	return items;
}

export async function getFiche(pool: Pool, actor: Actor, recordId: string): Promise<Fiche> {
	authorize(actor, "view");
	const record = await pool.query(
		"SELECT r.id, r.external_id, r.record_type, r.book_id, b.reference_code FROM archive_record r JOIN book b ON b.id = r.book_id WHERE r.id=$1",
		[recordId],
	);
	const row = record.rows[0];
	if (!row) throw new EditorialFailure("not_found", "Record not found");
	const history = await loadRevisions(pool, recordId);
	const current = history[0];
	if (!current) throw new EditorialFailure("not_found", "Record has no revisions");
	const located = await pool.query("SELECT locator FROM record_revision WHERE id=$1", [current.id]);
	const secondary = await pool.query(
		`SELECT payload FROM historical_entry
		 WHERE payload->'entry'->>'externalId' = $1
		   AND (payload->'entry'->>'bookReference' IS NULL OR payload->'entry'->>'bookReference' = $2)
		 ORDER BY created_at, id`,
		[row.external_id ?? "", row.reference_code ?? ""],
	);
	return {
		recordId,
		externalId: row.external_id,
		recordType: row.record_type,
		reference: await loadReference(pool, row.book_id, current.id, located.rows[0]?.locator ?? null),
		current,
		history,
		humanReading: history.find((r) => r.method === "manual") ?? null,
		automaticProposal: history.find((r) => r.method === "import") ?? null,
		secondaryIndex: secondary.rows.map(({ payload }) => ({
			citation: String(payload.citation),
			kind: payload.entry.kind,
			confidence: String(payload.entry.confidence ?? "unknown"),
			text: payload.entry.text ?? null,
			locator: payload.entry.locator ?? null,
			tif: payload.entry.tif ?? null,
		})),
		permissions: editorialActions.filter((action) => can(actor.role, action)),
	};
}

async function withRecordLock<T>(
	pool: Pool,
	recordId: string,
	work: (client: PoolClient) => Promise<T>,
): Promise<T> {
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const locked = await client.query("SELECT id FROM archive_record WHERE id=$1 FOR UPDATE", [
			recordId,
		]);
		if (!locked.rows[0]) throw new EditorialFailure("not_found", "Record not found");
		const result = await work(client);
		await client.query("COMMIT");
		return result;
	} catch (error) {
		await client.query("ROLLBACK");
		if (
			error instanceof Error &&
			"code" in error &&
			(error.code === "23503" || error.code === "23514")
		)
			throw new EditorialFailure("invalid_request", `Invalid content: ${error.message}`);
		throw error;
	} finally {
		client.release();
	}
}

async function recordEvent(
	client: Queryable,
	event: {
		recordId: string;
		revisionId: string;
		action: string;
		actor: Actor;
		from: string | null;
		to: string;
		note?: string | undefined;
	},
) {
	await client.query(
		"INSERT INTO revision_event (record_id, revision_id, action, actor_id, actor_role, from_status, to_status, note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
		[
			event.recordId,
			event.revisionId,
			event.action,
			event.actor.id,
			event.actor.role,
			event.from,
			event.to,
			event.note ?? null,
		],
	);
}

/**
 * Saves an edit as a new draft revision. If someone saved after the editor's base revision, the
 * edit is merged field by field when the changes do not overlap; otherwise it is refused with the
 * conflicting fields and the current revision, and nothing is written.
 */
export async function editRevision(
	pool: Pool,
	actor: Actor,
	recordId: string,
	request: EditRevisionRequest,
): Promise<{ revision: RevisionView; merged: boolean }> {
	authorize(actor, "edit");
	return withRecordLock(pool, recordId, async (client) => {
		const views = await loadRevisions(client, recordId);
		const latest = views[0];
		const base = views.find((view) => view.id === request.baseRevisionId);
		if (!latest || !base)
			throw new EditorialFailure("invalid_request", "Base revision does not belong to the record");
		let content: RevisionContent = request.content;
		let merged = false;
		if (base.id !== latest.id) {
			const result = mergeRevisionContent(base.content, request.content, latest.content);
			if (!result.ok)
				throw new EditorialFailure("conflict", "Concurrent edit touches the same fields", {
					conflicts: result.conflicts,
					current: latest,
				});
			content = result.content;
			merged = true;
		}
		if (sameValue(content, latest.content))
			throw new EditorialFailure("no_changes", "Edit does not change the current revision");
		const meta = await client.query<{ source_id: string; locator: string | null }>(
			"SELECT source_id, locator FROM record_revision WHERE id=$1",
			[latest.id],
		);
		const hash = createHash("sha256")
			.update(canonical({ content, supersedes: latest.id, method: "manual" }))
			.digest("hex");
		const inserted = await client.query<{ id: string }>(
			`INSERT INTO record_revision (record_id, revision_number, content_hash, date, folio, place_as_written, normalized_place, original_text, marginal_notes, status, source_id, method, locator, recorded_by, supersedes_revision_id)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft',$10,'manual',$11,$12,$13) RETURNING id`,
			[
				recordId,
				latest.revisionNumber + 1,
				hash,
				content.date ? JSON.stringify(content.date) : null,
				content.folio,
				content.placeAsWritten,
				content.normalizedPlace,
				content.originalText,
				content.marginalNotes,
				meta.rows[0]?.source_id,
				meta.rows[0]?.locator ?? null,
				actor.id,
				latest.id,
			],
		);
		const revisionId = inserted.rows[0]?.id;
		if (!revisionId) throw new Error("Revision insertion returned no id");
		for (const p of content.participants)
			await client.query(
				"INSERT INTO participant (revision_id,role,name_as_written,normalized_name,legibility,role_as_written,notes,position) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
				[
					revisionId,
					p.role,
					p.nameAsWritten,
					p.normalizedName,
					p.legibility,
					p.roleAsWritten,
					p.notes,
					p.position,
				],
			);
		for (const image of content.images)
			await client.query(
				"INSERT INTO record_revision_image (revision_id,image_id,region) VALUES ($1,$2,$3)",
				[revisionId, image.imageId, image.region ? JSON.stringify(image.region) : null],
			);
		await recordEvent(client, {
			recordId,
			revisionId,
			action: merged ? "merged" : "edited",
			actor,
			from: latest.status,
			to: "draft",
			note: request.note,
		});
		const saved = (await loadRevisions(client, recordId))[0];
		if (!saved) throw new Error("Saved revision not found");
		return { revision: saved, merged };
	});
}

/** Moves the latest revision of a record along the editorial workflow and audits the change. */
export async function decide(
	pool: Pool,
	actor: Actor,
	recordId: string,
	decision: EditorialDecision,
	input: { revisionId: string; note?: string | undefined },
): Promise<RevisionView> {
	authorize(actor, decision);
	return withRecordLock(pool, recordId, async (client) => {
		const views = await loadRevisions(client, recordId);
		const latest = views[0];
		const target = views.find((view) => view.id === input.revisionId);
		if (!latest || !target) throw new EditorialFailure("not_found", "Revision not found");
		if (target.id !== latest.id)
			throw new EditorialFailure("stale_revision", "A newer revision exists; review it instead", {
				current: latest,
			});
		const rule = decisionTransitions[decision];
		if (!(rule.from as readonly string[]).includes(target.status))
			throw new EditorialFailure(
				"invalid_transition",
				`Cannot ${decision} a revision that is ${target.status}`,
				{ current: target },
			);
		if (decision === "publish") {
			const rights = await client.query<{ unknown_count: number }>(
				`SELECT count(*)::int AS unknown_count FROM (
				   SELECT s.rights_status FROM record_revision v JOIN source s ON s.id = v.source_id WHERE v.id=$1
				   UNION ALL
				   SELECT i.rights_status FROM record_revision_image l JOIN image_ref i ON i.id = l.image_id WHERE l.revision_id=$1
				 ) r WHERE r.rights_status = 'unknown'`,
				[target.id],
			);
			if ((rights.rows[0]?.unknown_count ?? 0) > 0)
				throw new EditorialFailure(
					"rights_unknown",
					"Publication requires known rights for the source and images",
				);
		}
		const updated = await client.query(
			"UPDATE record_revision SET status=$2 WHERE id=$1 AND status=$3::validation_status",
			[target.id, rule.to, target.status],
		);
		if (updated.rowCount !== 1)
			throw new EditorialFailure("conflict", "Revision changed concurrently");
		await recordEvent(client, {
			recordId,
			revisionId: target.id,
			action: decision,
			actor,
			from: target.status,
			to: rule.to,
			note: input.note,
		});
		const saved = (await loadRevisions(client, recordId))[0];
		if (!saved) throw new Error("Saved revision not found");
		return saved;
	});
}
