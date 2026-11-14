import type { SearchResult } from "@hdata/domain";
import { formatDate, methodLabel, recordTypeLabel } from "./labels.ts";

/** Facts of a seat with their origin; shared by results and the seat page. */
export function RecordFacts({ record }: { record: SearchResult }) {
	return (
		<dl>
			<dt>Data</dt>
			<dd>{formatDate(record.date)}</dd>
			<dt>Lugar</dt>
			<dd>{record.place ?? "Não indicado"}</dd>
			<dt>Livro</dt>
			<dd>
				{record.book.referenceCode ? `${record.book.referenceCode} — ` : ""}
				{record.book.title}
				{record.folio ? `, fólio ${record.folio}` : ""}
				{record.locator ? ` (${record.locator})` : ""}
			</dd>
			<dt>Tipo</dt>
			<dd>{recordTypeLabel[record.recordType]}</dd>
			<dt>Origem</dt>
			<dd>
				{record.origin.sourceName} ({record.origin.sourceKind}) —{" "}
				{methodLabel[record.origin.method]}
				{record.origin.citation ? `. ${record.origin.citation}` : ""}
			</dd>
			<dt>Estado</dt>
			<dd>Publicado</dd>
		</dl>
	);
}
