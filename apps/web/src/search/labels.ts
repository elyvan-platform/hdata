import type { PartialDate, RecordType, SearchQueryInput } from "@hdata/domain";

export const recordTypeLabel: Record<RecordType, string> = {
	baptism: "Batismo",
	marriage: "Casamento",
	death: "Óbito",
	undetermined: "Tipo indeterminado",
};

export const methodLabel = { import: "Importação", manual: "Transcrição manual" } as const;

/** Shows the date as written when the source gave one; otherwise only the parts that are known. */
export function formatDate(date: PartialDate | null): string {
	if (!date || date.precision === "unknown") return "Data desconhecida";
	if (date.asWritten) return date.asWritten;
	const text = [
		date.day === undefined ? undefined : String(date.day).padStart(2, "0"),
		date.month === undefined ? undefined : String(date.month).padStart(2, "0"),
		date.year === undefined ? undefined : String(date.year),
	]
		.filter((part) => part !== undefined)
		.join("/");
	const qualifier = {
		exact: "",
		circa: "c. ",
		before: "antes de ",
		after: "depois de ",
		uncertain: "incerta: ",
	};
	return `${qualifier[date.qualifier]}${text}`;
}

/** Link to the home page carrying the given search; unset values are left out of the URL. */
export function searchHref(query: SearchQueryInput, path = "/"): string {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query))
		if (value !== undefined && value !== "") params.set(key, String(value));
	return params.size > 0 ? `${path}?${params}` : path;
}

export function describeError(error: unknown): string {
	return error instanceof Error ? error.message : "erro desconhecido";
}
