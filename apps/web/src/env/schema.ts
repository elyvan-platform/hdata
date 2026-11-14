import { z } from "zod";

export const envSchema = z.object({
	API_URL: z
		.string()
		.url()
		.default("http://localhost:3001")
		.describe("Base URL of the API (server-side only)"),
	COMMIT_SHA: z.string().min(1).optional().describe("Commit reported by /version (optional)"),
});

export type Env = z.infer<typeof envSchema>;
