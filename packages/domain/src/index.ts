import { z } from "zod";

export const healthResponseSchema = z.object({
	status: z.literal("ok"),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const checkStatusSchema = z.enum(["up", "down"]);

export const readyResponseSchema = z.object({
	status: z.enum(["ready", "not_ready"]),
	checks: z.record(z.string(), checkStatusSchema),
});
export type ReadyResponse = z.infer<typeof readyResponseSchema>;

export const versionResponseSchema = z.object({
	name: z.string().min(1),
	version: z.string().min(1),
	commit: z.string().min(1).optional(),
});
export type VersionResponse = z.infer<typeof versionResponseSchema>;

export * from "./archive.ts";
export * from "./catalog.ts";
export * from "./historical-index.ts";

export * from "./search.ts";
