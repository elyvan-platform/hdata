import { createApiClient } from "@hdata/api-client";
import { bookExtractionRequestSchema, bookExtractionStatusSchema } from "@hdata/domain";
import Link from "next/link";
import { getEnv } from "../../../env/index.ts";
import { type BatchState, TranscribeForm } from "./transcribe-form.tsx";

export const dynamic = "force-dynamic";

const errors: Record<string, string> = {
	disabled: "A API não tem o token de atualização configurado.",
	unauthorized: "Token incorreto.",
	invalid_range: "Intervalo inválido. Escolha até 20 páginas.",
	book_unavailable: "Livro sem visualizador disponível.",
	worker_disabled: "O worker de transcrição não está ativo na API.",
	rights_unknown:
		"A autorização de processamento externo ainda não está registada para esta fonte.",
	digitarq_unavailable: "Não foi possível obter a lista de páginas no Digitarq.",
};

async function submit(previous: BatchState, form: FormData): Promise<BatchState> {
	"use server";
	const token = form.get("token");
	const input = bookExtractionRequestSchema.safeParse({
		book: form.get("book"),
		first: form.get("first"),
		limit: form.get("limit"),
		enqueue: form.get("operation") === "enqueue",
		rightsEvidence: form.get("authorize") === "on" ? form.get("rightsEvidence") : undefined,
	});
	if (!input.success || typeof token !== "string" || !/^[!-~]{16,1024}$/.test(token))
		return { ...previous, message: "Indique o livro, o intervalo e o token de atualização." };
	try {
		const response = await fetch(`${getEnv().API_URL.replace(/\/+$/, "")}/catalog/extraction`, {
			method: "POST",
			headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
			body: JSON.stringify(input.data),
			cache: "no-store",
			redirect: "error",
			signal: AbortSignal.timeout(30_000),
		});
		if (!response.ok) {
			const body = await response.json().catch(() => null);
			const code = typeof body?.error === "string" ? body.error : "";
			return {
				...previous,
				message: Object.hasOwn(errors, code)
					? (errors[code] ?? "Erro ao atualizar o lote.")
					: "Operação não confirmada. Consulte o progresso antes de repetir.",
			};
		}
		return {
			result: bookExtractionStatusSchema.parse(await response.json()),
			book: input.data.book,
			message: input.data.enqueue
				? "Pedido de transcrição processado. Consulte o estado por página."
				: "Estado atualizado.",
		};
	} catch {
		return {
			...previous,
			message: "Operação não confirmada. Consulte o progresso antes de repetir.",
		};
	}
}

export default async function TranscriptionPage() {
	const catalog = await createApiClient({ baseUrl: getEnv().API_URL })
		.catalog()
		.catch(() => null);
	return (
		<main id="conteudo">
			<h1>Transcrever livros do Digitarq</h1>
			<p>
				<Link href="/catalogo">Voltar ao catálogo</Link> ·{" "}
				<Link href="/revisao/propostas">Rever propostas</Link>
			</p>
			{catalog ? (
				<TranscribeForm action={submit} books={catalog.books.filter((book) => book.viewerUrl)} />
			) : (
				<p role="alert">Não foi possível carregar o catálogo.</p>
			)}
		</main>
	);
}
