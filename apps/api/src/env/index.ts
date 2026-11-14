import { type Env, envSchema } from "./schema.ts";

export type { Env };

/** Validates the environment; throws with every invalid variable listed. */
export function parseEnv(source: Record<string, string | undefined>): Env {
	const result = envSchema.safeParse(source);
	if (!result.success) {
		const issues = result.error.issues
			.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
			.join("\n");
		throw new Error(`Invalid environment:\n${issues}`);
	}
	return result.data;
}
