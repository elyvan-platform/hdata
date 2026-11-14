/** Normalize only for comparison; retain source text for display and storage. */
export function normalizeSearchText(value: string): string {
	return value
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.toLocaleLowerCase("pt-PT")
		.replace(/\b(?:vila|villa)\s+(?:caiz|cahiz)\b/g, "vila caiz")
		.replace(/\b(?:vilarinho|villarinho)\b/g, "vilarinho")
		.replace(/\s+/g, " ")
		.trim();
}
