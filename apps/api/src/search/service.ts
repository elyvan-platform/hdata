import {
	type CoverageResponse,
	normalizeSearchText,
	type SearchQuery,
	type SearchResponse,
	type SearchResult,
	searchResultSchema,
} from "@hdata/domain";
import type { Pool } from "pg";

/**
 * Consultation reads only the latest *published* revision of each record, so a later draft never
 * changes or hides what was published, and nothing unreviewed is reachable through search,
 * counts or image URLs.
 */
const PUBLISHED = `
	FROM archive_record r
	JOIN LATERAL (
		SELECT * FROM record_revision
		WHERE record_id = r.id AND status = 'published'
		ORDER BY revision_number DESC LIMIT 1
	) v ON true
	JOIN source s ON s.id = v.source_id
	JOIN book b ON b.id = r.book_id`;

type Row = {
	record_id: string;
	record_type: string;
	book_title: string;
	book_reference: string | null;
	book_source_url: string | null;
	book_viewer_url: string | null;
	revision_id: string;
	method: string;
	status: string;
	date: unknown;
	folio: string | null;
	place_as_written: string | null;
	normalized_place: string | null;
	locator: string | null;
	source_name: string;
	source_kind: string;
	source_citation: string | null;
};

const COLUMNS = `
	r.id AS record_id, r.record_type, b.title AS book_title, b.reference_code AS book_reference,
	b.source_url AS book_source_url, b.viewer_url AS book_viewer_url,
	v.id AS revision_id, v.method, v.status, v.date, v.folio, v.place_as_written, v.normalized_place,
	v.locator, s.name AS source_name, s.kind AS source_kind, s.citation AS source_citation`;

type ParticipantRow = {
	revision_id: string;
	role: string;
	name_as_written: string;
	normalized_name: string | null;
	role_as_written: string | null;
	notes: string | null;
	legibility: string;
};

async function loadParticipants(pool: Pool, revisionIds: string[]) {
	const byRevision = new Map<string, ParticipantRow[]>();
	if (revisionIds.length === 0) return byRevision;
	const result = await pool.query<ParticipantRow>(
		`SELECT revision_id, role, name_as_written, normalized_name, role_as_written, notes, legibility
		 FROM participant WHERE revision_id = ANY($1::uuid[]) ORDER BY revision_id, position`,
		[revisionIds],
	);
	for (const row of result.rows)
		byRevision.set(row.revision_id, [...(byRevision.get(row.revision_id) ?? []), row]);
	return byRevision;
}

async function loadImages(pool: Pool, revisionIds: string[]) {
	const byRevision = new Map<string, SearchResult["images"]>();
	if (revisionIds.length === 0) return byRevision;
	const result = await pool.query<{
		revision_id: string;
		id: string;
		folio: string | null;
		side: string;
		url: string | null;
	}>(
		`SELECT l.revision_id, i.id, i.folio, i.side, i.url
		 FROM record_revision_image l JOIN image_ref i ON i.id = l.image_id
		 WHERE l.revision_id = ANY($1::uuid[]) ORDER BY l.revision_id, i.sequence`,
		[revisionIds],
	);
	for (const row of result.rows)
		byRevision.set(row.revision_id, [
			...(byRevision.get(row.revision_id) ?? []),
			{ id: row.id, folio: row.folio, side: row.side, url: row.url },
		]);
	return byRevision;
}

function toResult(
	row: Row,
	participants: ParticipantRow[],
	images: SearchResult["images"],
): SearchResult {
	return searchResultSchema.parse({
		recordId: row.record_id,
		recordType: row.record_type,
		status: row.status,
		date: row.date ?? null,
		place: row.place_as_written ?? row.normalized_place,
		folio: row.folio,
		locator: row.locator,
		participants: participants.map((p) => ({
			role: p.role_as_written ?? p.role,
			name: p.name_as_written,
			legibility: p.legibility,
		})),
		origin: {
			sourceName: row.source_name,
			sourceKind: row.source_kind,
			citation: row.source_citation,
			method: row.method,
		},
		book: {
			referenceCode: row.book_reference,
			title: row.book_title,
			recordUrl: row.book_source_url,
			viewerUrl: row.book_viewer_url,
		},
		images,
	});
}

type DateValue = { year?: number; month?: number; day?: number; asWritten?: string };

function dateWords(value: unknown): string[] {
	if (typeof value !== "object" || value === null) return [];
	const { year, month, day, asWritten }: DateValue = value;
	const mm = month === undefined ? undefined : String(month).padStart(2, "0");
	const dd = day === undefined ? undefined : String(day).padStart(2, "0");
	return [
		asWritten,
		year === undefined ? undefined : String(year),
		year !== undefined && mm ? `${year}-${mm}` : undefined,
		year !== undefined && mm && dd ? `${year}-${mm}-${dd}` : undefined,
		year !== undefined && mm ? `${mm}/${year}` : undefined,
		year !== undefined && mm && dd ? `${dd}/${mm}/${year}` : undefined,
	].filter((word): word is string => word !== undefined);
}

/**
 * Names, relatives (every participant), place, profession (role and notes) and date. The text of
 * the manuscript is deliberately not searched here. Comparison uses the shared normalization;
 * every query word must be the start of some word, so "joao" finds "João" but is never read as
 * proof of identity.
 */
function haystack(row: Row, participants: ParticipantRow[]): string[] {
	const text = [
		row.place_as_written,
		row.normalized_place,
		...participants.flatMap((p) => [
			p.name_as_written,
			p.normalized_name,
			p.role_as_written,
			p.notes,
		]),
	];
	return [...text.filter((t): t is string => !!t), ...dateWords(row.date)].flatMap((t) =>
		normalizeSearchText(t).split(" "),
	);
}

function matches(words: string[], query: string): boolean {
	return normalizeSearchText(query)
		.split(" ")
		.filter(Boolean)
		.every((token) => words.some((word) => word.startsWith(token)));
}

/**
 * Filters by type, book and period in SQL and by text in memory: PostgreSQL has no accent- and
 * variant-insensitive comparison matching `normalizeSearchText` without extensions that are not
 * yet decided (see the search plan); the published set of one parish is small.
 */
export async function searchRecords(pool: Pool, query: SearchQuery): Promise<SearchResponse> {
	const rows = (
		await pool.query<Row>(
			`SELECT ${COLUMNS} ${PUBLISHED}
			 WHERE ($1::text IS NULL OR r.record_type::text = $1)
			   AND ($2::text IS NULL OR b.reference_code = $2)
			   AND ($3::int IS NULL OR (v.date->>'year')::int >= $3)
			   AND ($4::int IS NULL OR (v.date->>'year')::int <= $4)
			 ORDER BY (v.date->>'year')::int NULLS LAST, (v.date->>'month')::int NULLS LAST,
			          (v.date->>'day')::int NULLS LAST, r.id`,
			[query.type ?? null, query.book ?? null, query.from ?? null, query.to ?? null],
		)
	).rows;
	const offset = (query.page - 1) * query.pageSize;
	const text = query.q;
	let participants: Map<string, ParticipantRow[]>;
	let matched: Row[];
	if (text) {
		participants = await loadParticipants(
			pool,
			rows.map((row) => row.revision_id),
		);
		matched = rows.filter((row) =>
			matches(haystack(row, participants.get(row.revision_id) ?? []), text),
		);
	} else {
		matched = rows;
		participants = new Map();
	}
	const pageRows = matched.slice(offset, offset + query.pageSize);
	const ids = pageRows.map((row) => row.revision_id);
	if (!text) participants = await loadParticipants(pool, ids);
	const images = await loadImages(pool, ids);
	return {
		total: matched.length,
		page: query.page,
		pageSize: query.pageSize,
		results: pageRows.map((row) =>
			toResult(row, participants.get(row.revision_id) ?? [], images.get(row.revision_id) ?? []),
		),
	};
}

export async function getPublishedRecord(
	pool: Pool,
	recordId: string,
): Promise<SearchResult | null> {
	const row = (await pool.query<Row>(`SELECT ${COLUMNS} ${PUBLISHED} WHERE r.id = $1`, [recordId]))
		.rows[0];
	if (!row) return null;
	const [participants, images] = await Promise.all([
		loadParticipants(pool, [row.revision_id]),
		loadImages(pool, [row.revision_id]),
	]);
	return toResult(row, participants.get(row.revision_id) ?? [], images.get(row.revision_id) ?? []);
}

export async function getCoverage(pool: Pool): Promise<CoverageResponse> {
	const result = await pool.query<{
		reference_code: string | null;
		title: string;
		published: number;
	}>(
		`SELECT b.reference_code, b.title,
		        (SELECT count(*)::int FROM archive_record r
		          WHERE r.book_id = b.id
		            AND EXISTS (SELECT 1 FROM record_revision v WHERE v.record_id = r.id AND v.status = 'published')
		        ) AS published
		 FROM book b ORDER BY b.reference_code NULLS LAST, b.title`,
	);
	const books = result.rows.map((row) => ({
		referenceCode: row.reference_code,
		title: row.title,
		publishedRecords: row.published,
	}));
	return {
		publishedRecords: books.reduce((sum, book) => sum + book.publishedRecords, 0),
		books,
	};
}
