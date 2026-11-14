import type { SearchResult } from "@hdata/domain";

const sideLabel: Record<string, string> = {
	recto: "frente",
	verso: "verso",
	unknown: "lado desconhecido",
};

/** Official record, viewer and image references of a seat; each is shown only when it exists. */
export function SourceLinks({ record }: { record: SearchResult }) {
	const { book, images } = record;
	const hasLinks = book.recordUrl || book.viewerUrl || images.length > 0;
	if (!hasLinks) return <p className="muted">Sem ligação à fonte disponível para este assento.</p>;
	return (
		<ul>
			{book.recordUrl && (
				<li>
					<a href={book.recordUrl} rel="noopener noreferrer">
						Ficha oficial do livro
					</a>
				</li>
			)}
			{book.viewerUrl && (
				<li>
					<a href={book.viewerUrl} rel="noopener noreferrer">
						Abrir no visualizador
					</a>
				</li>
			)}
			{images.map((image) => {
				const label = `Imagem${image.folio ? `, fólio ${image.folio}` : ""} (${sideLabel[image.side] ?? image.side})`;
				return (
					<li key={image.id}>
						{image.url ? (
							<a href={image.url} rel="noopener noreferrer">
								{label}
							</a>
						) : (
							<span>{label} — sem ligação disponível</span>
						)}
					</li>
				);
			})}
		</ul>
	);
}
