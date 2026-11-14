import {
	decisionRequestSchema,
	editRevisionRequestSchema,
	rejectRequestSchema,
	validationStatusSchema,
} from "@hdata/domain";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { decide, editRevision, getFiche, listQueue } from "../editorial/service.ts";
import { type Actor, type Authenticator, EditorialFailure } from "../editorial/types.ts";

export type ReviewRouteOptions = { pool: Pool; authenticate: Authenticator };

const params = z.object({ recordId: z.uuid() });
const queueQuery = z.object({
	status: z.union([validationStatusSchema, z.array(validationStatusSchema)]).optional(),
});

function invalid(error: z.ZodError) {
	return new EditorialFailure("invalid_request", error.issues.map((i) => i.message).join("; "));
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
	const result = schema.safeParse(value);
	if (!result.success) throw invalid(result.error);
	return result.data;
}

export function registerReviewRoutes(app: FastifyInstance, options: ReviewRouteOptions) {
	const authenticate = async (request: FastifyRequest): Promise<Actor> => {
		const actor = await options.authenticate({ authorization: request.headers.authorization });
		if (!actor) throw new EditorialFailure("unauthorized", "Invalid or missing credentials");
		return actor;
	};
	const handle =
		<T>(work: (request: FastifyRequest, actor: Actor) => Promise<T>, successCode = 200) =>
		async (request: FastifyRequest, reply: FastifyReply) => {
			try {
				const result = await work(request, await authenticate(request));
				return reply.code(successCode).send(result);
			} catch (error) {
				if (!(error instanceof EditorialFailure)) throw error;
				return reply
					.code(error.httpStatus)
					.send({ error: error.code, message: error.message, ...error.details });
			}
		};

	app.get(
		"/review/queue",
		handle(async (request, actor) => {
			const { status } = parse(queueQuery, request.query);
			return {
				items: await listQueue(options.pool, actor, status ? [status].flat() : undefined),
			};
		}),
	);
	app.get(
		"/review/records/:recordId",
		handle((request, actor) =>
			getFiche(options.pool, actor, parse(params, request.params).recordId),
		),
	);
	app.post(
		"/review/records/:recordId/revisions",
		handle(
			(request, actor) =>
				editRevision(
					options.pool,
					actor,
					parse(params, request.params).recordId,
					parse(editRevisionRequestSchema, request.body),
				),
			201,
		),
	);
	for (const decision of ["submit", "validate", "reject", "publish"] as const)
		app.post(
			`/review/records/:recordId/${decision}`,
			handle((request, actor) =>
				decide(
					options.pool,
					actor,
					parse(params, request.params).recordId,
					decision,
					parse(decision === "reject" ? rejectRequestSchema : decisionRequestSchema, request.body),
				),
			),
		);
}
