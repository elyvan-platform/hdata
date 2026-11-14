import { afterEach, describe, expect, it, vi } from "vitest";
import { parseEnv } from "../env/index.ts";
import { GET as health } from "./health/route.ts";
import { GET as ready } from "./ready/route.ts";
import { GET as version } from "./version/route.ts";

afterEach(() => vi.unstubAllEnvs());

describe("operational routes", () => {
	it("answers /health", async () => {
		expect(await health().json()).toEqual({ status: "ok" });
	});

	it("answers /ready with a valid environment", async () => {
		const response = ready();
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: "ready", checks: { env: "up" } });
	});

	it("answers /version", async () => {
		vi.stubEnv("COMMIT_SHA", "abc123");
		expect(await version().json()).toMatchObject({ name: "@hdata/web", commit: "abc123" });
	});

	it("rejects an invalid environment", () => {
		expect(() => parseEnv({ API_URL: "not a url" })).toThrow(/API_URL/);
	});
});
