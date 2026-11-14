import { createApiClient } from "@hdata/api-client";
import type { CatalogResponse } from "@hdata/domain";
import { getEnv } from "../../env/index.ts";

export const dynamic = "force-dynamic";

const dataLabel = {
	fresh: "Catálogo atualizado",
	stored_copy: "Cópia guardada (a última atualização falhou)",
	none: "Sem catálogo válido",
} as const;

async function load(): Promise<{ catalog: CatalogResponse } | { error: string }> {
	try {
		return { catalog: await createApiClient({ baseUrl: getEnv().API_URL }).catalog() };
	} catch (error) {
		return { error: error instanceof Error ? error.message : "unknown error" };
	}
}

export default async function CatalogPage() {
	const result = await load();
	if ("error" in result)
		return (
			<main>
				<h1>Catálogo</h1>
				<p role="alert">Catálogo indisponível: {result.error}</p>
			</main>
		);
	const { status, books } = result.catalog;
	return (
		<main>
			<h1>Catálogo</h1>
			<p>{dataLabel[status.data]}</p>
			<p>Último sucesso: {status.lastSuccessAt ?? "nunca"}</p>
			{status.lastAttempt?.outcome === "failure" && (
				<p role="alert">
					Última tentativa ({status.lastAttempt.attemptedAt}) falhou: {status.lastAttempt.errorCode}
					{status.lastAttempt.message ? ` — ${status.lastAttempt.message}` : ""}
				</p>
			)}
			{status.data === "none" ? (
				<p>Ainda não existe nenhum catálogo válido.</p>
			) : (
				<ul>
					{books.map((book) => (
						<li key={book.referenceCode}>
							{book.referenceCode} — {book.title}
							{book.recordUrl && (
								<>
									{" "}
									<a href={book.recordUrl}>ficha</a>
								</>
							)}
							{book.viewerUrl && (
								<>
									{" "}
									<a href={book.viewerUrl}>visualizador</a>
								</>
							)}
						</li>
					))}
				</ul>
			)}
		</main>
	);
}
