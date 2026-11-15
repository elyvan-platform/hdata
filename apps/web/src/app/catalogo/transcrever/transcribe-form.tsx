"use client";

import type { bookExtractionStatusSchema, CatalogBook } from "@hdata/domain";
import { useActionState, useState } from "react";
import type { z } from "zod";

export type BatchState = {
	message: string;
	book?: string;
	result?: z.infer<typeof bookExtractionStatusSchema>;
};
const failureLabels: Record<string, string> = {
	model_output: "Resposta antiga inválida; detalhe indisponível",
	model_empty: "O modelo não devolveu texto",
	model_invalid_json: "O modelo devolveu JSON inválido",
	model_schema: "A resposta não cumpriu o formato esperado",
	model_truncated: "O modelo atingiu o limite de saída",
};
const labels = {
	not_queued: "Por iniciar",
	queued: "Em fila",
	running: "A transcrever",
	succeeded: "Processada",
	failed: "Falhou",
};

export function TranscribeForm({
	action,
	books,
}: {
	action: (state: BatchState, form: FormData) => Promise<BatchState>;
	books: CatalogBook[];
}) {
	const [state, submit, pending] = useActionState(action, { message: "" });
	const [token, setToken] = useState("");
	const [book, setBook] = useState(books[0]?.referenceCode ?? "");
	const [first, setFirst] = useState("1");
	const [limit, setLimit] = useState("5");
	if (!books.length) return <p>O catálogo ainda não tem livros com visualizador.</p>;
	return (
		<>
			<form className="card" action={submit}>
				<fieldset disabled={pending}>
					<label htmlFor="book">Livro</label>
					<select
						id="book"
						name="book"
						value={book}
						onChange={(event) => setBook(event.currentTarget.value)}
						required
					>
						{books.map((book) => (
							<option key={book.referenceCode} value={book.referenceCode}>
								{book.referenceCode} · {book.title}
							</option>
						))}
					</select>
					<label htmlFor="first">Primeira página</label>
					<input
						id="first"
						name="first"
						type="number"
						min={1}
						max={100000}
						value={first}
						onChange={(event) => setFirst(event.currentTarget.value)}
						required
					/>
					<label htmlFor="limit">Número de páginas</label>
					<input
						id="limit"
						name="limit"
						type="number"
						min={1}
						max={20}
						value={limit}
						onChange={(event) => setLimit(event.currentTarget.value)}
						required
					/>
					<label htmlFor="token">Token de atualização do catálogo</label>
					<input
						id="token"
						name="token"
						type="password"
						autoComplete="off"
						required
						minLength={16}
						maxLength={1024}
						value={token}
						onChange={(event) => setToken(event.currentTarget.value)}
					/>
					<details>
						<summary>Registar autorização de processamento externo</summary>
						<p>
							Preencha apenas se verificou que a licença ou autorização cobre o envio das imagens da
							fonte Digitarq ao serviço de transcrição. A decisão aplica-se à fonte inteira.
						</p>
						<label htmlFor="rightsEvidence">Referência da autorização ou licença</label>
						<input id="rightsEvidence" name="rightsEvidence" maxLength={1000} />
						<label>
							<input name="authorize" type="checkbox" /> Confirmo que a autorização abrange esta
							fonte
						</label>
					</details>
					<button type="submit" name="operation" value="status">
						Ver progresso
					</button>
					<button type="submit" name="operation" value="enqueue">
						Iniciar transcrição
					</button>
					<button type="submit" name="operation" value="retry">
						Reprocessar páginas falhadas
					</button>
				</fieldset>
			</form>
			<p role="status">{pending ? "A consultar…" : state.message}</p>
			{state.result && (
				<section>
					<h2>{state.book}</h2>
					<p>
						{state.result.pages.filter((page) => page.status === "succeeded").length} de{" "}
						{state.result.pages.length} páginas processadas neste intervalo · {state.result.total}{" "}
						ficheiros no livro
					</p>
					<ul>
						{state.result.pages.map((page) => (
							<li key={page.page}>
								<a href={page.viewerUrl}>Página {page.page}</a> · {labels[page.status]}
								{page.status === "succeeded" && page.proposalCount === 0 && " — sem assentos"}
								{page.error && ` (${failureLabels[page.error] ?? page.error})`}
							</li>
						))}
					</ul>
				</section>
			)}
		</>
	);
}
