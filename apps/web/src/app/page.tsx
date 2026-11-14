import { createApiClient } from "@hdata/api-client";
import {
	type CatalogBook,
	type CoverageResponse,
	recordTypes,
	type SearchQuery,
	type SearchQueryInput,
	type SearchResponse,
	searchQuerySchema,
} from "@hdata/domain";
import { getEnv } from "../env/index.ts";
import { describeError, recordTypeLabel, searchHref } from "../search/labels.ts";
import { Participants } from "../search/participants.tsx";
import { RecordFacts } from "../search/record-details.tsx";
import { SourceLinks } from "../search/source-links.tsx";
import { specimen } from "./specimen.ts";

export const dynamic = "force-dynamic";

type Outcome<T> = { ok: true; value: T } | { ok: false; error: string };

async function attempt<T>(work: () => Promise<T>): Promise<Outcome<T>> {
	try {
		return { ok: true, value: await work() };
	} catch (error) {
		return { ok: false, error: describeError(error) };
	}
}

/** Filters in use, each with the query change that removes it. */
function appliedFilters(query: SearchQuery) {
	const filters: { label: string; clear: SearchQueryInput }[] = [];
	if (query.type)
		filters.push({ label: `Tipo: ${recordTypeLabel[query.type]}`, clear: { type: "" } });
	if (query.book) filters.push({ label: `Livro: ${query.book}`, clear: { book: "" } });
	if (query.from !== undefined)
		filters.push({ label: `Do ano ${query.from}`, clear: { from: undefined } });
	if (query.to !== undefined)
		filters.push({ label: `Ao ano ${query.to}`, clear: { to: undefined } });
	return filters;
}

const firstValue = (value: string | string[] | undefined) =>
	Array.isArray(value) ? value[0] : value;

function Coverage({
	coverage,
	catalogBooks,
}: {
	coverage: Outcome<CoverageResponse>;
	catalogBooks: number | undefined;
}) {
	if (!coverage.ok) return <p role="alert">Cobertura indisponível: {coverage.error}</p>;
	const { publishedRecords, publishedPages, books } = coverage.value;
	const withSeats = books.filter((book) => book.publishedRecords > 0).length;
	if (publishedRecords === 0)
		return (
			<p>
				Ainda não há assentos publicados: a pesquisa não devolverá resultados até serem validados e
				publicados.
			</p>
		);
	return (
		<p>
			{publishedRecords} {publishedRecords === 1 ? "assento publicado" : "assentos publicados"} em{" "}
			{withSeats} {withSeats === 1 ? "livro" : "livros"}
			{catalogBooks === undefined ? "" : ` de ${catalogBooks} no catálogo`}. A cobertura é parcial:
			só se pesquisa o que já foi revisto e publicado. {publishedPages} páginas de manuscrito
			associadas a assentos publicados; o total de páginas do acervo ainda não foi confirmado.
		</p>
	);
}

function Results({ query, outcome }: { query: SearchQuery; outcome: Outcome<SearchResponse> }) {
	if (!outcome.ok) return <p role="alert">A pesquisa falhou: {outcome.error}. Tente novamente.</p>;
	const { total, page, pageSize, results } = outcome.value;
	if (total === 0)
		return <p role="status">Nenhum assento publicado corresponde a esta pesquisa.</p>;
	const pages = Math.ceil(total / pageSize);
	const link = (target: number) => searchHref({ ...query, page: target });
	return (
		<>
			<p role="status">
				{total} {total === 1 ? "resultado" : "resultados"} — página {page} de {pages}
			</p>
			{results.length === 0 && (
				<p>
					Esta página não tem resultados. <a href={link(pages)}>Ir para a última página</a>
				</p>
			)}
			<ol className="results">
				{results.map((record) => (
					<li key={record.recordId}>
						<h3>
							<a href={`/assento/${record.recordId}`}>
								{record.participants[0]?.name ?? "Assento sem nome legível"}
							</a>
						</h3>
						<RecordFacts record={record} />
						<Participants record={record} />
						<SourceLinks record={record} />
					</li>
				))}
			</ol>
			<nav className="pager" aria-label="Paginação dos resultados">
				{page > 1 ? <a href={link(page - 1)}>Página anterior</a> : <span>Página anterior</span>}
				{page < pages ? <a href={link(page + 1)}>Página seguinte</a> : <span>Página seguinte</span>}
			</nav>
		</>
	);
}

export default async function Home({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const raw = Object.fromEntries(
		Object.entries(await searchParams).map(([key, value]) => [key, firstValue(value)]),
	);
	const parsed = searchQuerySchema.safeParse(raw);
	const searched = Object.keys(raw).length > 0;
	const client = createApiClient({ baseUrl: getEnv().API_URL });
	const [catalog, coverage, outcome] = await Promise.all([
		attempt(() => client.catalog()),
		attempt(() => client.coverage()),
		searched && parsed.success ? attempt(() => client.search(parsed.data)) : undefined,
	]);
	const books: CatalogBook[] = catalog.ok ? catalog.value.books : [];
	const query = parsed.success ? parsed.data : undefined;
	const applied = query ? appliedFilters(query) : [];

	return (
		<main id="conteudo">
			<div className="hero">
				<div className="hero-content">
					<span className="eyebrow">Arquivo histórico · Vila Caiz</span>
					<h1>Memória de Caiz</h1>
					<p className="lead">
						Pesquise os assentos paroquiais de Vila Caiz por texto transcrito, nome, familiares,
						lugar, profissão ou data. Cada resultado leva à fonte oficial.
					</p>
					<search>
						<form className="search-form" method="get" action="/">
							<label htmlFor="q">Nome, familiares, lugar, profissão ou data</label>
							<div className="search-row">
								<input
									id="q"
									name="q"
									type="search"
									defaultValue={query?.q ?? ""}
									maxLength={200}
								/>
								<button type="submit">Pesquisar</button>
							</div>
							<details className="more-filters" open={applied.length > 0}>
								<summary>Mais filtros</summary>
								<div className="filter-grid">
									<div>
										<label htmlFor="type">Tipo</label>
										<select id="type" name="type" defaultValue={query?.type ?? ""}>
											<option value="">Todos</option>
											{recordTypes.map((type) => (
												<option key={type} value={type}>
													{recordTypeLabel[type]}
												</option>
											))}
										</select>
									</div>
									<div>
										<label htmlFor="book">Livro</label>
										<select
											id="book"
											name="book"
											defaultValue={query?.book ?? ""}
											disabled={!catalog.ok}
										>
											<option value="">Todos</option>
											{books.map((book) => (
												<option key={book.referenceCode} value={book.referenceCode}>
													{book.referenceCode} — {book.title}
												</option>
											))}
										</select>
									</div>
									<div>
										<label htmlFor="from">Do ano</label>
										<input
											id="from"
											name="from"
											type="number"
											min={1}
											max={9999}
											defaultValue={query?.from}
										/>
									</div>
									<div>
										<label htmlFor="to">Ao ano</label>
										<input
											id="to"
											name="to"
											type="number"
											min={1}
											max={9999}
											defaultValue={query?.to}
										/>
									</div>
								</div>
							</details>
						</form>
					</search>
					{query && applied.length > 0 && (
						<ul className="applied-filters" aria-label="Filtros aplicados">
							{applied.map((filter) => (
								<li key={filter.label}>
									<a href={searchHref({ ...query, ...filter.clear, page: undefined })}>
										{filter.label}
										<span className="sr-only"> — remover filtro</span>
										<span aria-hidden="true"> ×</span>
									</a>
								</li>
							))}
						</ul>
					)}
					<div className="coverage">
						<Coverage coverage={coverage} catalogBooks={catalog.ok ? books.length : undefined} />
					</div>
				</div>
				{specimen && (
					<figure className="specimen">
						<img
							src={specimen.src}
							width={specimen.width}
							height={specimen.height}
							alt={specimen.alt}
						/>
						<figcaption>
							{specimen.reference} · <a href={specimen.sourceUrl}>Ver a fonte</a>
							<span className="muted"> · {specimen.rights}</span>
						</figcaption>
					</figure>
				)}
			</div>
			{!catalog.ok && (
				<p role="alert">
					Lista de livros indisponível ({catalog.error}); a pesquisa por livro está desativada.
				</p>
			)}
			<p>
				<a href="/catalogo">Ver o catálogo completo dos livros</a>
			</p>
			<section aria-labelledby="resultados">
				<h2 id="resultados">Resultados</h2>
				{!parsed.success && (
					<p role="alert">
						Pesquisa inválida: {parsed.error.issues.map((issue) => issue.message).join("; ")}.
					</p>
				)}
				{query && outcome && <Results query={query} outcome={outcome} />}
				{!searched && <p className="muted">Escreva um nome ou escolha filtros para começar.</p>}
			</section>
		</main>
	);
}
