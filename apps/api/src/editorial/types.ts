import type { EditorialRole } from "@hdata/domain";

export type Actor = { id: string; role: EditorialRole };

/** Resolves the caller of a request; null means the request carries no valid credentials. */
export type Authenticator = (headers: {
	authorization?: string | undefined;
}) => Promise<Actor | null> | Actor | null;

export type EditorialErrorCode =
	| "unauthorized"
	| "forbidden"
	| "not_found"
	| "invalid_request"
	| "conflict"
	| "stale_revision"
	| "invalid_transition"
	| "no_changes"
	| "rights_unknown";

const statusByCode: Record<EditorialErrorCode, number> = {
	unauthorized: 401,
	forbidden: 403,
	not_found: 404,
	invalid_request: 422,
	conflict: 409,
	stale_revision: 409,
	invalid_transition: 409,
	no_changes: 422,
	rights_unknown: 422,
};

export class EditorialFailure extends Error {
	readonly code: EditorialErrorCode;
	readonly details: Record<string, unknown>;
	constructor(code: EditorialErrorCode, message: string, details: Record<string, unknown> = {}) {
		super(message);
		this.name = "EditorialFailure";
		this.code = code;
		this.details = details;
	}
	get httpStatus(): number {
		return statusByCode[this.code];
	}
}
