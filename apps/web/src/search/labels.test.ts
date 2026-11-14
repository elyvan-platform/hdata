import { describe, expect, it } from "vitest";
import { formatDate, searchHref } from "./labels.ts";

describe("formatDate", () => {
	it("shows unknown dates explicitly and prefers the date as written", () => {
		expect(formatDate(null)).toBe("Data desconhecida");
		expect(formatDate({ precision: "unknown", qualifier: "exact" })).toBe("Data desconhecida");
		expect(
			formatDate({ year: 1850, precision: "year", qualifier: "exact", asWritten: "anno de 1850" }),
		).toBe("anno de 1850");
	});

	it("shows only the known parts with their qualifier", () => {
		expect(formatDate({ year: 1850, month: 3, day: 2, precision: "day", qualifier: "exact" })).toBe(
			"02/03/1850",
		);
		expect(formatDate({ year: 1850, precision: "year", qualifier: "circa" })).toBe("c. 1850");
	});
});

describe("searchHref", () => {
	it("leaves out empty values", () => {
		expect(searchHref({ q: "joão", type: "", page: 2 })).toBe("/?q=jo%C3%A3o&page=2");
		expect(searchHref({})).toBe("/");
	});
});
