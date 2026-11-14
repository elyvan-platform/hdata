import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import type { Database } from "./db/client.ts";
import { parseEnv } from "./env/index.ts";

const env = parseEnv({ NODE_ENV: "test", COMMIT_SHA: "abc123" });

function build(ping: Database["ping"]) {
	return buildApp({ env, database: { ping, close: async () => {} } });
}

describe("operational endpoints", () => {
	const apps: ReturnType<typeof build>[] = [];
	afterEach(async () => {
		await Promise.all(apps.splice(0).map((app) => app.close()));
	});
	const make = (ping: Database["ping"]) => {
		const app = build(ping);
		apps.push(app);
		return app;
	};

	it("answers /health", async () => {
		const response = await make(async () => {}).inject("/health");
		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ status: "ok" });
	});

	it("is ready when the database answers", async () => {
		const response = await make(async () => {}).inject("/ready");
		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ status: "ready", checks: { database: "up" } });
	});

	it("is not ready (503) when the database fails", async () => {
		const response = await make(async () => {
			throw new Error("connection refused");
		}).inject("/ready");
		expect(response.statusCode).toBe(503);
		expect(response.json()).toEqual({ status: "not_ready", checks: { database: "down" } });
	});

	it("answers /version", async () => {
		const response = await make(async () => {}).inject("/version");
		expect(response.json()).toMatchObject({ name: "@hdata/api", commit: "abc123" });
	});
});

describe("env", () => {
	it("rejects an invalid environment", () => {
		expect(() => parseEnv({ PORT: "abc" })).toThrow(/PORT/);
	});
});
