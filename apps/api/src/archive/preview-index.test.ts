import { historicalMappingSchema } from "@hdata/domain";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { previewIndex, readIndexFile } from "./preview-index.ts";

export const mapping = historicalMappingSchema.parse({
	sourceId: "00000000-0000-4000-8000-000000000001",
	citation: "Synthetic fixture",
	reuseEvidence: "Synthetic test data",
	kind: "index",
	recordType: "baptism",
	columns: {
		externalId: "id",
		text: "texto",
		tif: "tif",
		bookReference: "livro",
		locator: "folio",
		confidence: "confianca",
	},
});
const row = { id: "b1", texto: "João", tif: "m0006.TIF", extra: "more complete evidence" };
describe("historical preview", () => {
	it("preserves evidence, rejects invalid rows and counts unique identities", () => {
		const report = previewIndex([row, row, { texto: "no id" }], mapping);
		expect(report.candidates[0]?.entry.raw).toEqual(row);
		expect(report.candidates[0]?.entry.tif).toBe("m0006.TIF");
		expect(report.duplicates).toHaveLength(1);
		expect(report.rejected).toHaveLength(1);
		expect(report.difference).toEqual({ baptism: -483, marriage: -254 });
		expect(report.reconciled).toBe(false);
	});
	it("keeps richer prior versions and flags differing identities and matching locators across sources", () => {
		const old = previewIndex([{ ...row, livro: "L1", folio: "2" }], mapping).candidates;
		const changed = { ...row, texto: "different", livro: "L1", folio: "2" };
		const report = previewIndex([changed], mapping, old);
		expect(report.conflicts).toHaveLength(1);
		expect(report.conflicts[0]?.existing[0]?.entry.raw).toEqual({
			...row,
			livro: "L1",
			folio: "2",
		});
		const repeated = previewIndex([changed], mapping, [...old, ...report.candidates]);
		expect(repeated.unchanged).toHaveLength(1);
		expect(repeated.conflicts).toHaveLength(1);
		expect(
			previewIndex([changed], { ...mapping, sourceId: "00000000-0000-4000-8000-000000000002" }, old)
				.conflicts,
		).toHaveLength(1);
	});
	it("detects competing rows within a file, missing entries and does not merge names", () => {
		expect(previewIndex([row, { ...row, texto: "other" }], mapping).conflicts).toHaveLength(2);
		const old = previewIndex([row], mapping).candidates;
		expect(previewIndex([], mapping, old).missing).toEqual(old);
		expect(previewIndex([{ ...row, id: "b2" }], mapping, old).additions).toHaveLength(1);
	});
	it("compares the complete synthetic baseline without claiming it is historical data", () => {
		const rows = Array.from({ length: 738 }, (_, i) => ({
			id: String(i),
			type: i < 484 ? "baptism" : "marriage",
		}));
		const report = previewIndex(rows, {
			...mapping,
			columns: { externalId: "id", recordType: "type" },
		});
		expect(report.totals).toEqual({ baptism: 484, marriage: 254 });
		expect(report.reconciled).toBe(true);
	});
	it("keeps death transcription provenance and unknown confidence without filling gaps", () => {
		const report = previewIndex([row], { ...mapping, kind: "transcription", recordType: "death" });
		expect(report.candidates[0]).toMatchObject({
			citation: mapping.citation,
			entry: { kind: "transcription", recordType: "death", confidence: "unknown" },
		});
		expect(report.candidates[0]?.entry.date).toBeUndefined();
	});
	it("reads real XLSX and JSON, rejecting malformed files, headers and formula values", async () => {
		const book = new ExcelJS.Workbook();
		const sheet = book.addWorksheet("Index");
		sheet.addRow(["id", "texto", "tif", "livro", "folio", "confianca"]);
		sheet.addRow(["b1", "João", "m0006.TIF"]);
		sheet.addRow(["b2", { formula: '"João"', result: "João" }]);
		const bytes = Buffer.from(await book.xlsx.writeBuffer());
		const rows = await readIndexFile(bytes, "xlsx", mapping);
		const report = previewIndex(rows, mapping);
		expect(report.candidates).toHaveLength(1);
		expect(report.rejected).toHaveLength(1);
		expect(await readIndexFile(Buffer.from(JSON.stringify([row])), "json", mapping)).toEqual([row]);
		await expect(readIndexFile(Buffer.from("{}"), "json", mapping)).rejects.toThrow();
		await expect(readIndexFile(bytes, "xlsx", { ...mapping, sheet: "absent" })).rejects.toThrow(
			"Worksheet",
		);
		sheet.getCell("B1").value = "id";
		await expect(
			readIndexFile(Buffer.from(await book.xlsx.writeBuffer()), "xlsx", mapping),
		).rejects.toThrow("Headers");
	});
});
