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
	const rawToken = form.get("token");
	const token = typeof rawToken === "string" ? rawToken.trim() : "";
	if (
		token.length < 16 ||
		token.length > 1024 ||
		Array.from(token).some((character) => {
			const code = character.charCodeAt(0);
			return code < 33 || code === 127 || code > 255 || /\s/u.test(character);
		})
	)
		return {
			...previous,
			message:
				"Token inválido. Use o mesmo token de Atualizar catálogo, com pelo menos 16 caracteres e sem espaços.",
		};

	const enqueue = form.get("operation") === "enqueue";
	const authorize = enqueue && form.get("authorize") === "on";
	const evidence = form.get("rightsEvidence");
	if (
		authorize &&
		(typeof evidence !== "string" || evidence.trim().length < 12 || evidence.trim().length > 1000)
	)
		return {
			...previous,
			message:
				"Indique a referência da autorização (12 a 1000 caracteres) ou desmarque a confirmação se a autorização já estiver registada.",
		};

	const input = bookExtractionRequestSchema.safeParse({
		book: form.get("book"),
		first: form.get("first"),
		limit: form.get("limit"),
		enqueue,
		rightsEvidence: authorize ? evidence : undefined,
	});
	if (!input.success) {
		const field = input.error.issues[0]?.path[0];
		const message =
			field === "book"
				? "Selecione um livro."
				: field === "first"
					? "Indique uma primeira página válida (1 a 100 000)."
					: "Indique um número de páginas entre 1 e 20.";
		return { ...previous, message };
	}
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
