import { createHash } from "node:crypto";
import {
	type HistoricalMapping,
	type HistoricalStoredEntry,
	historicalBaseline,
	historicalEntrySchema,
	historicalMappingSchema,
	historicalStoredEntrySchema,
} from "@hdata/domain";
import ExcelJS from "exceljs";
import { z } from "zod";

export function canonical(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
	if (value !== null && typeof value === "object")
		return `{${Object.entries(value)
			.filter(([, v]) => v !== undefined)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
			.join(",")}}`;
	return JSON.stringify(value) ?? "null";
}
export function entryHash(value: HistoricalStoredEntry) {
	return createHash("sha256").update(canonical(value)).digest("hex");
}

/** No inferred headers, dates, IDs, or values from neighbouring rows. */
export async function readIndexFile(
	bytes: Buffer,
	format: "json" | "xlsx",
	mapping: HistoricalMapping,
): Promise<unknown[]> {
	if (format === "json") return z.array(z.unknown()).parse(JSON.parse(bytes.toString("utf8")));
	const workbook = new ExcelJS.Workbook();
	await workbook.xlsx.load(new Uint8Array(bytes).buffer);
	const sheet = mapping.sheet ? workbook.getWorksheet(mapping.sheet) : workbook.worksheets[0];
	if (!sheet) throw new Error("Worksheet not found");
	const headers = new Map<number, string>();
	sheet.getRow(1).eachCell((cell, column) => {
		if (typeof cell.value !== "string" || !cell.value || [...headers.values()].includes(cell.value))
			throw new Error("Headers must be unique nonempty strings");
		headers.set(column, cell.value);
	});
	for (const column of Object.values(mapping.columns))
		if (column && ![...headers.values()].includes(column))
			throw new Error(`Missing column: ${column}`);
	const rows: unknown[] = [];
	sheet.eachRow((row, number) => {
		if (number === 1) return;
		const values: Record<string, unknown> = {};
		row.eachCell((cell, column) => {
			const header = headers.get(column);
			if (!header) throw new Error(`Missing header at column ${column}`);
			values[header] = cell.value;
		});
		rows.push(values);
	});
	return rows;
}

export function previewIndex(input: unknown[], config: unknown, previous: unknown[] = []) {
	const mapping = historicalMappingSchema.parse(config);
	const stored = z.array(historicalStoredEntrySchema).parse(previous);
	const candidates: HistoricalStoredEntry[] = [];
	const rejected: { row: number; issues: string; raw: unknown }[] = [];
	for (const [index, raw] of input.entries()) {
		const object = z.record(z.string(), z.unknown()).safeParse(raw);
		if (!object.success) {
			rejected.push({ row: index + 1, issues: object.error.message, raw });
			continue;
		}
		const fields: Record<string, unknown> = {};
		for (const [field, column] of Object.entries(mapping.columns))
			if (column) {
				const value = object.data[column];
				if (value !== null && value !== "" && value !== undefined) fields[field] = value;
			}
		const result = historicalEntrySchema.safeParse({
			...fields,
			recordType: fields.recordType ?? mapping.recordType,
			kind: mapping.kind,
			raw: object.data,
		});
		if (!result.success) {
			rejected.push({ row: index + 1, issues: result.error.message, raw });
			continue;
		}
		candidates.push({
			sourceId: mapping.sourceId,
			citation: mapping.citation,
			reuseEvidence: mapping.reuseEvidence,
			entry: result.data,
		});
	}
	const duplicates: HistoricalStoredEntry[] = [];
	const unchanged: HistoricalStoredEntry[] = [];
	const additions: HistoricalStoredEntry[] = [];
	const conflicts: {
		incoming: HistoricalStoredEntry;
		existing: HistoricalStoredEntry[];
		reason: string;
	}[] = [];
	const seen = new Set<string>();
	for (const candidate of candidates) {
		const hash = entryHash(candidate);
		if (seen.has(hash)) {
			duplicates.push(candidate);
			continue;
		}
		seen.add(hash);
		const repeated = stored.some((entry) => entryHash(entry) === hash);
		if (repeated) unchanged.push(candidate);
		const related = [...stored, ...candidates.filter((other) => other !== candidate)].filter(
			(other) =>
				(other.sourceId === candidate.sourceId &&
					other.entry.externalId === candidate.entry.externalId &&
					entryHash(other) !== hash) ||
				(other.entry.bookReference &&
					other.entry.locator &&
					other.entry.bookReference === candidate.entry.bookReference &&
					other.entry.locator === candidate.entry.locator &&
					other.entry.recordType === candidate.entry.recordType &&
					entryHash(other) !== hash),
		);
		if (related.length)
			conflicts.push({
				incoming: candidate,
				existing: related,
				reason: "identity_or_locator_requires_editorial_review",
			});
		else if (!repeated) additions.push(candidate);
	}
	const totals = { baptism: 0, marriage: 0 };
	const identities = new Set<string>();
	for (const { entry, sourceId } of [
		...stored.filter((s) => s.sourceId === mapping.sourceId),
		...candidates,
	]) {
		const key = canonical([sourceId, entry.externalId]);
		if (identities.has(key)) continue;
		identities.add(key);
		if (entry.recordType === "baptism" || entry.recordType === "marriage")
			totals[entry.recordType]++;
	}
	const missing = stored.filter(
		(s) =>
			s.sourceId === mapping.sourceId &&
			!candidates.some((c) => c.entry.externalId === s.entry.externalId),
	);
	return {
		candidates,
		additions,
		unchanged,
		duplicates,
		rejected,
		conflicts,
		missing,
		baseline: historicalBaseline,
		totals,
		difference: {
			baptism: totals.baptism - historicalBaseline.baptism,
			marriage: totals.marriage - historicalBaseline.marriage,
		},
		reconciled:
			totals.baptism === 484 &&
			totals.marriage === 254 &&
			rejected.length === 0 &&
			conflicts.length === 0 &&
			duplicates.length === 0 &&
			missing.length === 0,
	};
}
