import type { ReadyResponse } from "@hdata/domain";
import { getEnv } from "../../env/index.ts";

export const dynamic = "force-dynamic";

/** Ready once the environment is valid; the API's own readiness is reported by the API. */
export function GET() {
	try {
		getEnv();
	} catch (error) {
		console.error("web readiness check failed", error);
		const body: ReadyResponse = { status: "not_ready", checks: { env: "down" } };
		return Response.json(body, { status: 503 });
	}
	const body: ReadyResponse = { status: "ready", checks: { env: "up" } };
	return Response.json(body);
}
