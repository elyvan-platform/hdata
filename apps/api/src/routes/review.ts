import {
	can,
	decisionRequestSchema,
	editRevisionRequestSchema,
	proposalListSchema,
	proposedSeatSchema,
	rejectRequestSchema,
	summarizeSeatConfidence,
	validationStatusSchema,
} from "@hdata/domain";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { decide, editRevision, getFiche, listQueue } from "../editorial/service.ts";
import { type Actor, type Authenticator, EditorialFailure } from "../editorial/types.ts";
import { ProposalReviewError, reviewProposal } from "../extraction/service.ts";

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
		"/review/proposals",
		handle(async (request, actor) => {
			if (!can(actor.role, "edit"))
				throw new EditorialFailure("forbidden", "Sem acesso às propostas");
			const { q } = parse(z.object({ q: z.string().trim().max(120).default("") }), request.query);
			const { rows } = await options.pool.query(
				`SELECT p.id, b.reference_code AS book, i.sequence, p.confidence,p.content,
			        p.content #>> '{originalText,value}' AS text,
			        b.viewer_url AS viewer, i.external_id
			 FROM extraction_proposal p
			 JOIN extraction_run r ON r.id=p.run_id
			 JOIN image_ref i ON i.id=r.image_id
			 JOIN book b ON b.id=i.book_id
			 WHERE p.review_status='pending' AND r.status='succeeded'
			   AND b.viewer_url IS NOT NULL AND i.external_id ~ '^[0-9]+$'
			   AND ($1 = '' OR strpos(lower(coalesce(p.content #>> '{originalText,value}', '')),lower($1)) > 0)
			 ORDER BY p.created_at DESC, p.id LIMIT 50`,
				[q],
			);
			return proposalListSchema.parse({
				items: rows.flatMap((row) => {
					const url = new URL(row.viewer);
					if (
						url.origin !== "https://digitarq.arquivos.pt" ||
						!url.pathname.startsWith("/fileViewer/")
					)
						return [];
					url.searchParams.set("selectedFile", row.external_id);
					url.searchParams.set("fileType", "IMAGE");
					const seat = proposedSeatSchema.parse(row.content);
					return [
						{
							...row,
							viewerUrl: url.href,
							confidenceSummary: summarizeSeatConfidence(seat),
							namesToConfirm: seat.participants.some(
								({ participant }) =>
									participant.legibility !== "legible" ||
									participant.nameAsWritten.includes("[ilegível]"),
							),
						},
					];
				}),
			});
		}),
	);
	app.post(
		"/review/proposals/:id",
		handle(async (request, actor) => {
			const { id } = parse(z.object({ id: z.uuid() }), request.params);
			const { decision } = parse(
				z.object({ decision: z.enum(["accept", "reject"]) }),
				request.body,
			);
			try {
				return await reviewProposal(options.pool, { proposalId: id, decision, actor });
			} catch (error) {
				if (!(error instanceof ProposalReviewError)) throw error;
				throw new EditorialFailure(
					error.code === "already_reviewed" ? "conflict" : error.code,
					error.message,
				);
			}
		}),
	);

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
