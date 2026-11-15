import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { describeError, reviewClient } from "../session.ts";

export const dynamic = "force-dynamic";

async function decide(form: FormData) {
	"use server";
	const id = form.get("id");
	const decision = form.get("decision");
	const client = await reviewClient();
	if (!client) redirect("/revisao/entrar");
	if (typeof id !== "string" || (decision !== "accept" && decision !== "reject")) return;
	try {
		await client.decideProposal(id, decision);
	} catch (error) {
		redirect(`/revisao/propostas?${new URLSearchParams({ erro: describeError(error) })}`);
	}
	revalidatePath("/revisao");
	redirect(decision === "accept" ? "/revisao" : "/revisao/propostas");
}

export default async function ProposalsPage({
	searchParams,
}: {
	searchParams: Promise<{ q?: string; erro?: string }>;
}) {
	const client = await reviewClient();
	if (!client) redirect("/revisao/entrar");
	const { q = "", erro } = await searchParams;
	const result = await client
		.proposals(typeof q === "string" ? q.slice(0, 120) : "")
		.catch((error: unknown) => ({ error: describeError(error) }));
	return (
		<main id="conteudo">
			<h1>Transcrições automáticas por rever</h1>
			<p>
				<Link href="/revisao">Voltar à revisão editorial</Link>
			</p>
			<form>
				<label htmlFor="q">Pesquisar no texto transcrito</label>
				<input id="q" name="q" type="search" defaultValue={q} maxLength={120} />
				<button type="submit">Pesquisar</button>
			</form>
			{erro && <p role="alert">{erro}</p>}
			{"error" in result ? (
				<p role="alert">{result.error}</p>
			) : (
				<section aria-label="Propostas">
					{!result.items.length && <p>Nenhuma proposta encontrada.</p>}
					{result.items.length === 50 && (
						<p>A mostrar 50 propostas. Refine a pesquisa para reduzir os resultados.</p>
					)}
					{result.items.map((item) => (
						<article className="card" key={item.id}>
							<h2>
								{item.book} · Imagem {item.sequence}
							</h2>
							{item.confidenceSummary ? (
								<p>
									Confiança estimada ·{" "}
									<strong>Média {Math.round(item.confidenceSummary.mean * 100)}%</strong>
									{" · "}Mínima {Math.round(item.confidenceSummary.min * 100)}% (
									{item.confidenceSummary.minField}){" · "}Máxima{" "}
									{Math.round(item.confidenceSummary.max * 100)}%
								</p>
							) : (
								<p>Resumo da confiança indisponível.</p>
							)}
							{item.namesToConfirm && <p>Nomes por confirmar</p>}
							<p>{item.text}</p>
							<p>
								<a href={item.viewerUrl}>Abrir imagem no Digitarq</a>
							</p>
							<form action={decide}>
								<input type="hidden" name="id" value={item.id} />
								<button type="submit" name="decision" value="accept">
									Criar rascunho
								</button>
								<button type="submit" name="decision" value="reject">
									Rejeitar
								</button>
							</form>
						</article>
					))}
				</section>
			)}
		</main>
	);
}
