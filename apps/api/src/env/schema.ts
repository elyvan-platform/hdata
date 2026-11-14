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
	COMMIT_SHA: z.string().min(1).optional().describe("Commit reported by /version (optional)"),
});

export type Env = z.infer<typeof envSchema>;
