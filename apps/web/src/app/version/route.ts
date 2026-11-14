import { versionResponseSchema } from "@hdata/domain";
import pkg from "../../../package.json" with { type: "json" };
import { getEnv } from "../../env/index.ts";

export const dynamic = "force-dynamic";

export function GET() {
	return Response.json(
		versionResponseSchema.parse({
			name: pkg.name,
			version: pkg.version,
			commit: getEnv().COMMIT_SHA,
		}),
	);
}
