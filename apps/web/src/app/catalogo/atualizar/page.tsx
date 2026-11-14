import { ApiError, createApiClient } from "@hdata/api-client";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { getEnv } from "../../../env/index.ts";
import { RefreshForm } from "./refresh-form.tsx";

async function refresh(_previous: string, form: FormData): Promise<string> {
	"use server";
	const token = form.get("token");
	if (typeof token !== "string" || token.length < 16 || token.length > 1024 || /\s/.test(token)) {
		return "Introduza um token de atualização válido.";
	}

	try {
		const client = createApiClient({
			baseUrl: getEnv().API_URL,
			fetch: (input, init) =>
				fetch(input, {
					...init,
					cache: "no-store",
					redirect: "error",
					signal: AbortSignal.timeout(250_000),
				}),
		});
		const result = await client.refreshCatalog(token);
		revalidatePath("/catalogo");
		return result.unchanged
			? `Catálogo confirmado com ${result.bookCount} livros. Sem alterações.`
			: `Catálogo atualizado com ${result.bookCount} livros.`;
	} catch (error) {
		if (error instanceof ApiError) {
			if (error.status === 401) return "A API recusou o token. Confirme o valor configurado.";
			if (error.status === 403) return "A atualização do catálogo está desativada na API.";
			if (error.catalogError) return `Falha ao atualizar o catálogo (${error.catalogError.error}).`;
		}
		return "A atualização não foi confirmada. Consulte o estado no catálogo antes de tentar novamente.";
	}
}

export default function CatalogRefreshPage() {
	return (
		<main id="conteudo">
			<h1>Atualizar catálogo</h1>
			<p>Introduza o token de atualização configurado no serviço da API.</p>
			<RefreshForm action={refresh} />
			<p>
				<Link href="/catalogo">Voltar ao catálogo</Link>
			</p>
		</main>
	);
}
