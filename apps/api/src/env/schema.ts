import { z } from "zod";

export const envSchema = z.object({
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development")
		.describe("Runtime mode"),
	HOST: z.string().min(1).default("0.0.0.0").describe("Interface the server binds to"),
	PORT: z.coerce
		.number()
		.int()
		.min(1)
		.max(65535)
		.default(3001)
		.describe("Port the server listens on"),
	DATABASE_URL: z
		.string()
		.url()
		.default("postgres://hdata:hdata@localhost:5432/hdata")
		.describe("PostgreSQL connection string"),
	DIGITARQ_CATALOG_URL: z
		.string()
		.url()
		.optional()
		.describe("Digitarq catalog endpoint returning the fonds catalog as JSON (optional)"),
	DIGITARQ_FONDS_REFERENCE: z
		.string()
		.min(1)
		.default("PT/ADPRT/PRQ/PAMT38")
		.describe("Official reference of the fonds to import"),
	DIGITARQ_TIMEOUT_MS: z.coerce
		.number()
		.int()
		.min(100)
		.max(120000)
		.default(10000)
		.describe("Per-request timeout when querying Digitarq, in milliseconds"),
	CATALOG_REFRESH_TOKEN: z
		.string()
		.min(16)
		.optional()
		.describe("Bearer token that authorizes POST /catalog/refresh (optional; unset disables it)"),
	EDITORIAL_ACTORS: z
		.string()
		.min(2)
		.optional()
		.describe(
			'JSON array of {"token","id","role"} editorial actors; role is editor, reviewer, publisher or admin (optional; unset disables /review)',
		),
	ANTHROPIC_API_KEY: z
		.string()
		.min(1)
		.optional()
		.describe(
			"API key for the transcription model (optional; unset disables the extraction worker)",
		),
	EXTRACTION_MODEL: z
		.string()
		.min(1)
		.default("claude-sonnet-5-5")
		.describe("Model identifier used to propose transcriptions"),
	EXTRACTION_MAX_ATTEMPTS: z.coerce
		.number()
		.int()
		.min(1)
		.max(10)
		.default(3)
		.describe("Maximum attempts per extraction run before it is marked failed"),
	EXTRACTION_TIMEOUT_MS: z.coerce
		.number()
		.int()
		.min(1000)
		.max(600000)
		.default(120000)
		.describe("Per-request timeout for image download and model calls, in milliseconds"),
	COMMIT_SHA: z.string().min(1).optional().describe("Commit reported by /version (optional)"),
});

export type Env = z.infer<typeof envSchema>;
