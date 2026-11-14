import { z } from "zod";
import {
	imageLinkSchema,
	partialDateSchema,
	participantSchema,
	recordTypeSchema,
	validationStatusSchema,
} from "./archive.ts";

export const editorialRoles = ["editor", "reviewer", "publisher", "admin"] as const;
export const editorialRoleSchema = z.enum(editorialRoles);
export type EditorialRole = z.infer<typeof editorialRoleSchema>;

export const editorialActions = [
	"view",
	"edit",
	"submit",
	"validate",
	"reject",
	"publish",
] as const;
export type EditorialAction = (typeof editorialActions)[number];

const allowed: Record<EditorialRole, readonly EditorialAction[]> = {
	editor: ["view", "edit", "submit"],
	reviewer: ["view", "edit", "submit", "validate", "reject"],
	publisher: ["view", "publish"],
	admin: editorialActions,
};

export function can(role: EditorialRole, action: EditorialAction): boolean {
	return allowed[role].includes(action);
}

/** Status changes a decision may perform; editing creates a new draft instead. */
export const editorialDecisions = ["submit", "validate", "reject", "publish"] as const;
export const editorialDecisionSchema = z.enum(editorialDecisions);
export type EditorialDecision = z.infer<typeof editorialDecisionSchema>;

export const decisionTransitions = {
	submit: { from: ["draft"], to: "in_review" },
	validate: { from: ["in_review"], to: "validated" },
	reject: { from: ["draft", "in_review"], to: "rejected" },
	publish: { from: ["validated"], to: "published" },
} as const satisfies Record<
	EditorialDecision,
	{
		from: readonly z.infer<typeof validationStatusSchema>[];
		to: z.infer<typeof validationStatusSchema>;
	}
>;

/** The editable part of a revision; everything else is provenance and is never edited. */
export const revisionContentSchema = z.object({
	date: partialDateSchema.nullable().default(null),
	folio: z.string().nullable().default(null),
	placeAsWritten: z.string().nullable().default(null),
	normalizedPlace: z.string().nullable().default(null),
	originalText: z.string().nullable().default(null),
	marginalNotes: z.string().nullable().default(null),
	participants: z.array(participantSchema).default([]),
	images: z.array(imageLinkSchema).default([]),
});
export type RevisionContent = z.infer<typeof revisionContentSchema>;
export const contentFields = Object.keys(revisionContentSchema.shape) as (keyof RevisionContent)[];

export const editRevisionRequestSchema = z.object({
	/** Revision the editor was looking at; a newer one triggers a merge or a conflict. */
	baseRevisionId: z.uuid(),
	content: revisionContentSchema,
	note: z.string().min(1).optional(),
});
export type EditRevisionRequest = z.infer<typeof editRevisionRequestSchema>;

export const decisionRequestSchema = z.object({
	revisionId: z.uuid(),
	note: z.string().min(1).optional(),
});
export const rejectRequestSchema = decisionRequestSchema.extend({ note: z.string().min(1) });

function canonicalJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
	if (value !== null && typeof value === "object")
		return `{${Object.entries(value)
			.filter(([, v]) => v !== undefined)
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
			.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
			.join(",")}}`;
	return JSON.stringify(value) ?? "null";
}

export function sameValue(a: unknown, b: unknown): boolean {
	return canonicalJson(a) === canonicalJson(b);
}

export type ContentConflict = {
	field: keyof RevisionContent;
	base: unknown;
	mine: unknown;
	theirs: unknown;
};

export type MergeResult =
	| { ok: true; content: RevisionContent }
	| { ok: false; conflicts: ContentConflict[] };

/**
 * Three-way, field-level merge. A field changed on one side only is taken from that side; changed
 * identically on both is kept; changed differently on both is a conflict, never resolved silently.
 */
export function mergeRevisionContent(
	base: RevisionContent,
	mine: RevisionContent,
	theirs: RevisionContent,
): MergeResult {
	const merged: Record<string, unknown> = {};
	const conflicts: ContentConflict[] = [];
	for (const field of contentFields) {
		const mineChanged = !sameValue(base[field], mine[field]);
		const theirsChanged = !sameValue(base[field], theirs[field]);
		if (!mineChanged) merged[field] = theirs[field];
		else if (!theirsChanged || sameValue(mine[field], theirs[field])) merged[field] = mine[field];
		else {
			conflicts.push({ field, base: base[field], mine: mine[field], theirs: theirs[field] });
			merged[field] = theirs[field];
		}
	}
	if (conflicts.length > 0) return { ok: false, conflicts };
	return { ok: true, content: revisionContentSchema.parse(merged) };
}

export const revisionEventSchema = z.object({
	id: z.uuid(),
	revisionId: z.uuid(),
	action: z.enum(["created", "edited", "merged", ...editorialDecisions]),
	actorId: z.string().min(1),
	actorRole: editorialRoleSchema,
	fromStatus: validationStatusSchema.nullable(),
	toStatus: validationStatusSchema,
	note: z.string().nullable(),
	createdAt: z.string(),
});
export type RevisionEvent = z.infer<typeof revisionEventSchema>;

export const documentReferenceSchema = z.object({
	bookTitle: z.string(),
	bookReference: z.string().nullable(),
	viewerUrl: z.string().nullable(),
	sourceUrl: z.string().nullable(),
	locator: z.string().nullable(),
	images: z.array(
		z.object({
			id: z.uuid(),
			folio: z.string().nullable(),
			side: z.string(),
			url: z.string().nullable(),
			region: z.unknown().nullable(),
		}),
	),
});
export type DocumentReference = z.infer<typeof documentReferenceSchema>;

export const reviewQueueItemSchema = z.object({
	recordId: z.uuid(),
	externalId: z.string().nullable(),
	recordType: recordTypeSchema,
	revisionId: z.uuid(),
	revisionNumber: z.number().int(),
	status: validationStatusSchema,
	method: z.enum(["manual", "import"]),
	recordedBy: z.string().nullable(),
	recordedAt: z.string(),
	reference: documentReferenceSchema,
});
export type ReviewQueueItem = z.infer<typeof reviewQueueItemSchema>;
export const reviewQueueResponseSchema = z.object({ items: z.array(reviewQueueItemSchema) });
export type ReviewQueueResponse = z.infer<typeof reviewQueueResponseSchema>;

export const revisionViewSchema = z.object({
	id: z.uuid(),
	revisionNumber: z.number().int(),
	status: validationStatusSchema,
	method: z.enum(["manual", "import"]),
	recordedBy: z.string().nullable(),
	recordedAt: z.string(),
	supersedesRevisionId: z.uuid().nullable(),
	content: revisionContentSchema,
	events: z.array(revisionEventSchema),
});
export type RevisionView = z.infer<typeof revisionViewSchema>;

/**
 * The fiche keeps three kinds of evidence apart: a human reading (manual revision), the secondary
 * index (imported historical entries, never edited here) and the automatic proposal (imported
 * revision). Only the first is ever validated or published as a reading.
 */
export const ficheSchema = z.object({
	recordId: z.uuid(),
	externalId: z.string().nullable(),
	recordType: recordTypeSchema,
	reference: documentReferenceSchema,
	current: revisionViewSchema,
	history: z.array(revisionViewSchema),
	humanReading: revisionViewSchema.nullable(),
	automaticProposal: revisionViewSchema.nullable(),
	secondaryIndex: z.array(
		z.object({
			citation: z.string(),
			kind: z.enum(["index", "transcription"]),
			confidence: z.string(),
			text: z.string().nullable(),
			locator: z.string().nullable(),
			tif: z.string().nullable(),
		}),
	),
	permissions: z.array(z.enum(editorialActions)),
});
export type Fiche = z.infer<typeof ficheSchema>;

export const editorialErrorSchema = z.object({
	error: z.enum([
		"unauthorized",
		"forbidden",
		"not_found",
		"invalid_request",
		"conflict",
		"stale_revision",
		"invalid_transition",
		"no_changes",
		"rights_unknown",
	]),
	message: z.string(),
	conflicts: z
		.array(
			z.object({ field: z.string(), base: z.unknown(), mine: z.unknown(), theirs: z.unknown() }),
		)
		.optional(),
	current: revisionViewSchema.optional(),
});
export type EditorialError = z.infer<typeof editorialErrorSchema>;
