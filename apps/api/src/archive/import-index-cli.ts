import { open, readFile } from "node:fs/promises";
import { historicalMappingSchema } from "@hdata/domain";
import pg from "pg";
import { parseEnv } from "../env/index.ts";
import { previewIndex, readIndexFile } from "./preview-index.ts";
import { importIndex } from "./store-index.ts";

const [file, mappingFile, reportFile, mode] = process.argv.slice(2);
if (
	!file ||
	!mappingFile ||
	!reportFile ||
	(mode !== undefined && mode !== "--apply" && mode !== "--database")
)
	throw new Error(
		"Usage: index:import input.json|input.xlsx mapping.json report.json [--database|--apply]",
	);
if ([file, mappingFile].includes(reportFile))
	throw new Error("Report must not overwrite input or mapping");
const mapping = historicalMappingSchema.parse(JSON.parse(await readFile(mappingFile, "utf8")));
const format = file.endsWith(".xlsx") ? "xlsx" : file.endsWith(".json") ? "json" : undefined;
if (!format) throw new Error("Only JSON and XLSX are supported");
const rows = await readIndexFile(await readFile(file), format, mapping);
const output = await open(reportFile, "wx", 0o600);
try {
	let report: ReturnType<typeof previewIndex>;
	if (mode) {
		const pool = new pg.Pool({ connectionString: parseEnv(process.env).DATABASE_URL });
		try {
			report = await importIndex(pool, rows, mapping, mode === "--apply");
		} finally {
			await pool.end();
		}
	} else {
		report = previewIndex(rows, mapping);
	}
	await output.writeFile(`${JSON.stringify(report, null, 2)}\n`);
	console.log(
		JSON.stringify({
			applied: mode === "--apply",
			accepted: report.candidates.length,
			rejected: report.rejected.length,
			conflicts: report.conflicts.length,
			reconciled: report.reconciled,
		}),
	);
} finally {
	await output.close();
}
