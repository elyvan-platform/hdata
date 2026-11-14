import { ApiError, createApiClient } from "@hdata/api-client";
import type { SearchResult } from "@hdata/domain";
import { notFound } from "next/navigation";
import { getEnv } from "../../../env/index.ts";
import { describeError } from "../../../search/labels.ts";
import { Participants } from "../../../search/participants.tsx";
import { RecordFacts } from "../../../search/record-details.tsx";
import { SourceLinks } from "../../../search/source-links.tsx";

export const dynamic = "force-dynamic";

async function load(recordId: string): Promise<SearchResult | { error: string }> {
	try {
		return await createApiClient({ baseUrl: getEnv().API_URL }).record(recordId);
	} catch (error) {
		if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
		return { error: describeError(error) };
	}
}

export default async function RecordPage({ params }: { params: Promise<{ recordId: string }> }) {
	const record = await load((await params).recordId);
	if ("error" in record)
		return (
			<main id="conteudo">
				<h1>Assento</h1>
				<p role="alert">Não foi possível carregar o assento: {record.error}</p>
				<p>
					<a href="/">Voltar à pesquisa</a>
				</p>
			</main>
		);
	return (
		<main id="conteudo">
			<a className="back-link" href="/">
				← Voltar à pesquisa
			</a>
			<h1>{record.participants[0]?.name ?? "Assento sem nome legível"}</h1>
			<RecordFacts record={record} />
			<h2>Participantes</h2>
			<Participants record={record} />
			<h2>Fonte</h2>
			<SourceLinks record={record} />
		</main>
	);
}
