import { describe, expect, it } from "vitest";
import { readyResponseSchema, versionResponseSchema } from "./index.ts";

describe("operational schemas", () => {
	it("accepts a ready payload", () => {
		expect(readyResponseSchema.parse({ status: "ready", checks: { database: "up" } })).toEqual({
			status: "ready",
			checks: { database: "up" },
		});
	});

	it("rejects an unknown check status", () => {
		expect(
			readyResponseSchema.safeParse({ status: "ready", checks: { database: "?" } }).success,
		).toBe(false);
	});

	it("requires a version", () => {
		expect(versionResponseSchema.safeParse({ name: "x" }).success).toBe(false);
	});
});
