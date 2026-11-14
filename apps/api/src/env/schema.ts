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
	COMMIT_SHA: z.string().min(1).optional().describe("Commit reported by /version (optional)"),
});

export type Env = z.infer<typeof envSchema>;
