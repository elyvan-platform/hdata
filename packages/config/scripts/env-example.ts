// Generates `.env.example` from an app's Zod environment schema.
// Usage (from the app directory): node ../../packages/config/scripts/env-example.ts [--check]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ZodType } from "zod";

const check = process.argv.includes("--check");
const schemaPath = resolve("src/env/schema.ts");
const target = resolve(".env.example");

const mod: unknown = await import(pathToFileURL(schemaPath).href);
const shape = readShape(mod);

const blocks = Object.entries(shape).map(([name, field]) => {
	const lines: string[] = [];
	if (field.description) lines.push(`# ${field.description}`);
	lines.push(`${name}=${exampleValue(field)}`);
	return lines.join("\n");
});
const content = `${blocks.join("\n\n")}\n`;

if (check) {
	const current = existsSync(target) ? readFileSync(target, "utf8") : null;
	if (current !== content) {
		console.error(".env.example is stale: run `pnpm env:example` and commit the result.");
		process.exit(1);
	}
} else {
	writeFileSync(target, content);
}

function readShape(value: unknown): Record<string, ZodType> {
	if (typeof value === "object" && value !== null && "envSchema" in value) {
		const schema = value.envSchema;
		if (typeof schema === "object" && schema !== null && "shape" in schema) {
			return schema.shape as Record<string, ZodType>;
		}
	}
	throw new Error(`${schemaPath} must export \`envSchema\` as a Zod object schema.`);
}

function exampleValue(field: ZodType): string {
	const def: { type?: string; defaultValue?: unknown; innerType?: ZodType } = field.def;
	if (def.type === "default") return String(def.defaultValue);
	if (def.type === "optional" && def.innerType) return "";
	return "";
}
