import type { ReviewQueueItem } from "@hdata/domain";
import Link from "next/link";
import { describeError, reviewClient } from "./session.ts";

export const dynamic = "force-dynamic";

const statusLabel = {
	draft: "Rascunho",
	in_review: "Em revisão",
	validated: "Validado",
	rejected: "Rejeitado",
	published: "Publicado",
} as const;

async function load(): Promise<{ items: ReviewQueueItem[] } | { error: string } | null> {
	const client = await reviewClient();
	if (!client) return null;
	try {
		return await client.queue();
	} catch (error) {
		return { error: describeError(error) };
	}
}

export default async function ReviewQueuePage() {
	const result = await load();
	if (!result)
		return (
			<main>
				<h1>Revisão editorial</h1>
				<p>
					<Link href="/revisao/entrar">Entrar</Link> para ver a fila.
				</p>
			</main>
		);
	if ("error" in result)
		return (
			<main>
				<h1>Revisão editorial</h1>
				<p role="alert">Fila indisponível: {result.error}</p>
				<Link href="/revisao/entrar">Entrar com outro token</Link>
			</main>
		);
	return (
		<main>
			<h1>Revisão editorial</h1>
			{result.items.length === 0 ? (
				<p>Não há transcrições à espera de revisão.</p>
			) : (
				<ul>
					{result.items.map((item) => (
						<li key={item.recordId}>
							<Link href={`/revisao/${item.recordId}`}>
								{item.externalId ?? item.recordId} —{" "}
								{item.reference.bookReference ?? item.reference.bookTitle}
							</Link>{" "}
							({statusLabel[item.status]},{" "}
							{item.method === "manual" ? "leitura humana" : "proposta automática"})
							{item.reference.viewerUrl && (
								<>
									{" "}
									<a href={item.reference.viewerUrl} rel="noreferrer">
										documento
									</a>
								</>
							)}
						</li>
					))}
				</ul>
			)}
		</main>
	);
}
