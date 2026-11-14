import { createApiClient } from "@hdata/api-client";
import type { CatalogResponse } from "@hdata/domain";
import { getEnv } from "../../env/index.ts";
import { fondsUrl, summarizeCatalog } from "../../search/catalog-summary.ts";
import { recordTypeLabel, searchHref } from "../../search/labels.ts";

const seriesLabel = { baptism: "Batismos", marriage: "Casamentos", death: "Óbitos" } as const;

function FondsLink() {
	return (
		<a href={fondsUrl} rel="noreferrer">
			fundo oficial de Vila Caiz no Digitarq
		</a>
	);
}

export const dynamic = "force-dynamic";

const dataLabel = {
	fresh: "Catálogo atualizado",
	stored_copy: "Cópia guardada (a última atualização falhou)",
	none: "Sem catálogo válido",
} as const;

async function loadCounts(): Promise<Map<string, number> | undefined> {
	try {
		const { books } = await createApiClient({ baseUrl: getEnv().API_URL }).coverage();
		return new Map(
			books.flatMap((b) => (b.referenceCode ? [[b.referenceCode, b.publishedRecords]] : [])),
		);
	} catch {
		// Counts are supplementary; without them the page says so instead of showing zeros.
		return undefined;
	}
}

async function load(): Promise<{ catalog: CatalogResponse } | { error: string }> {
	try {
		return { catalog: await createApiClient({ baseUrl: getEnv().API_URL }).catalog() };
	} catch (error) {
		return { error: error instanceof Error ? error.message : "unknown error" };
	}
}

export default async function CatalogPage() {
	const [result, counts] = await Promise.all([load(), loadCounts()]);
	if ("error" in result)
		return (
			<main id="conteudo">
				<h1>Catálogo</h1>
				<p role="alert">Catálogo indisponível: {result.error}</p>
				<p>
					Consulte diretamente o <FondsLink />.
				</p>
			</main>
		);
	const { status, books } = result.catalog;
	return (
		<main id="conteudo">
			<h1>Catálogo</h1>
			<p>{dataLabel[status.data]}</p>
			<p className="muted">Último sucesso: {status.lastSuccessAt ?? "nunca"}</p>
			{status.lastAttempt?.outcome === "failure" && (
				<p role="alert">
					Última tentativa ({status.lastAttempt.attemptedAt}) falhou: {status.lastAttempt.errorCode}
					{status.lastAttempt.message ? ` — ${status.lastAttempt.message}` : ""}
				</p>
			)}
			{status.data === "none" ? (
				<div className="panel empty-state">
					<p>Ainda não existe nenhum catálogo válido.</p>
					<p>
						Consulte entretanto o <FondsLink />.
					</p>
				</div>
			) : (
				<>
					<ul className="series-summary" aria-label="Séries principais">
						{summarizeCatalog(books).map((series) => (
							<li key={series.type}>
								<h2>{seriesLabel[series.type]}</h2>
								{series.books === 0 ? (
									<p className="muted">Nenhum livro identificado no catálogo.</p>
								) : (
									<>
										<p>
											{series.books} {series.books === 1 ? "livro" : "livros"}
											{series.period ? ` · ${series.period.from}–${series.period.to}` : ""}
										</p>
										<p className="muted">
											{series.withImages === 0
												? "Sem imagens digitalizadas ligadas"
												: `Imagens digitalizadas em ${series.withImages} de ${series.books}`}
										</p>
									</>
								)}
								<a href={searchHref({ type: series.type })}>
									pesquisar {recordTypeLabel[series.type].toLowerCase()}s
								</a>
							</li>
						))}
					</ul>
					<h2>Todos os livros</h2>
					<ul className="book-list">
						{books.map((book) => (
							<li key={book.referenceCode}>
								<span className="code">{book.referenceCode}</span>
								<span className="title">{book.title}</span>
								<span className="muted">
									{counts === undefined
										? "Assentos publicados: indisponível"
										: `Assentos publicados: ${counts.get(book.referenceCode) ?? 0}`}
								</span>
								<span className="links">
									<a href={searchHref({ book: book.referenceCode })}>pesquisar neste livro</a>
									{book.recordUrl && <a href={book.recordUrl}>ficha</a>}
									{book.viewerUrl && <a href={book.viewerUrl}>visualizador</a>}
								</span>
							</li>
						))}
					</ul>
				</>
			)}
		</main>
	);
}
