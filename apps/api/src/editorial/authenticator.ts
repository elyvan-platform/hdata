import { createHash, timingSafeEqual } from "node:crypto";
import { editorialRoleSchema } from "@hdata/domain";
import { z } from "zod";
import type { Authenticator } from "./types.ts";

const actorsSchema = z.array(
	z.object({ token: z.string().min(16), id: z.string().min(1), role: editorialRoleSchema }),
);

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Parses `EDITORIAL_ACTORS` (JSON array of `{token, id, role}`); throws on invalid content. */
export function parseEditorialActors(raw: string) {
	return actorsSchema.parse(JSON.parse(raw));
}

/**
 * Bearer-token authenticator over a fixed list of actors. It is the seam where a Better Auth
 * session lookup plugs in: anything returning an `Actor` for a request can replace it.
 */
export function createTokenAuthenticator(actors: z.infer<typeof actorsSchema>): Authenticator {
	const entries = actors.map((actor) => ({ actor, hash: digest(actor.token) }));
	return (headers) => {
		const header = headers.authorization;
		if (!header?.startsWith("Bearer ")) return null;
		const given = digest(header.slice("Bearer ".length));
		let found: (typeof entries)[number] | undefined;
		for (const entry of entries) if (timingSafeEqual(entry.hash, given)) found = entry;
		return found ? { id: found.actor.id, role: found.actor.role } : null;
	};
}
