import { type EditorialDecision, type Fiche, revisionContentSchema } from "@hdata/domain";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { describeError, reviewClient } from "../session.ts";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ recordId: string }>; searchParams: Promise<{ error?: string }> };

const text = (form: FormData, name: string) => {
	const value = form.get(name);
	return typeof value === "string" && value.trim() !== "" ? value : null;
};

async function act(recordId: string, work: () => Promise<unknown>) {
	let error: string | undefined;
	try {
		await work();
	} catch (e) {
		error = describeError(e);
	}
	revalidatePath(`/revisao/${recordId}`);
	redirect(`/revisao/${recordId}${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}

async function save(form: FormData) {
	"use server";
	const recordId = String(form.get("recordId"));
	await act(recordId, async () => {
		const client = await reviewClient();
		if (!client) throw new Error("Sessão em falta");
		const baseRevisionId = String(form.get("baseRevisionId"));
		const fiche = await client.fiche(recordId);
		const base = fiche.history.find((revision) => revision.id === baseRevisionId);
		if (!base) throw new Error("Revisão base desconhecida");
		// Unedited fields keep the values of the revision the editor saw; the form only owns the text fields.
		const content = revisionContentSchema.parse({
			...base.content,
			folio: text(form, "folio"),
			placeAsWritten: text(form, "placeAsWritten"),
			originalText: text(form, "originalText"),
			marginalNotes: text(form, "marginalNotes"),
		});
		await client.edit(recordId, {
			baseRevisionId,
			content,
			...(text(form, "note") && { note: text(form, "note") ?? "" }),
		});
	});
}

async function decide(form: FormData) {
	"use server";
	const recordId = String(form.get("recordId"));
	const decision = String(form.get("decision")) as EditorialDecision;
	await act(recordId, async () => {
		const client = await reviewClient();
		if (!client) throw new Error("Sessão em falta");
		const note = text(form, "note");
		await client.decide(recordId, decision, {
			revisionId: String(form.get("revisionId")),
			...(note && { note }),
		});
	});
}

function Reading({ title, revision }: { title: string; revision: Fiche["humanReading"] }) {
	return (
		<section>
			<h2>{title}</h2>
			{revision ? (
				<>
					<pre>{revision.content.originalText ?? "(sem texto)"}</pre>
					<small>
						Revisão {revision.revisionNumber} · {revision.status} ·{" "}
						{revision.recordedBy ?? "importação"} · {revision.recordedAt}
					</small>
				</>
			) : (
				<p>Ainda não existe.</p>
			)}
		</section>
	);
}

export default async function FichePage({ params, searchParams }: Params) {
	const { recordId } = await params;
	const { error } = await searchParams;
	const client = await reviewClient();
	if (!client) redirect("/revisao/entrar");
	let fiche: Fiche;
	try {
		fiche = await client.fiche(recordId);
	} catch (e) {
		return (
			<main>
				<p role="alert">Ficha indisponível: {describeError(e)}</p>
				<Link href="/revisao">Voltar à fila</Link>
			</main>
		);
	}
	const { current, reference, permissions } = fiche;
	const previous = fiche.history[1];
	return (
		<main>
			<h1>
				{fiche.externalId ?? fiche.recordId} — {reference.bookTitle}
			</h1>
			{error && <p role="alert">{error}</p>}
			<section>
				<h2>Documento</h2>
				<p>
					{reference.bookReference} {reference.locator ?? ""}
				</p>
				{reference.viewerUrl && (
					<a href={reference.viewerUrl} rel="noreferrer">
						Abrir no visualizador oficial
					</a>
				)}{" "}
				{reference.sourceUrl && (
					<a href={reference.sourceUrl} rel="noreferrer">
						Ficha oficial
					</a>
				)}
				<ul>
					{reference.images.map((image) => (
						<li key={image.id}>
							{image.url ? (
								<a href={image.url} rel="noreferrer">
									Imagem {image.folio ?? ""} {image.side}
								</a>
							) : (
								`Imagem ${image.folio ?? ""} ${image.side}`
							)}
						</li>
					))}
				</ul>
			</section>
			<Reading title="Leitura humana" revision={fiche.humanReading} />
			<Reading title="Proposta automática (não validada)" revision={fiche.automaticProposal} />
			<section>
				<h2>Índice secundário</h2>
				{fiche.secondaryIndex.length === 0 ? (
					<p>Sem entradas.</p>
				) : (
					<ul>
						{fiche.secondaryIndex.map((entry) => (
							<li key={`${entry.citation}-${entry.text}`}>
								{entry.citation} ({entry.kind}, confiança {entry.confidence}): {entry.text ?? "—"}
							</li>
						))}
					</ul>
				)}
			</section>
			{previous && (
				<section>
					<h2>Comparação com a revisão {previous.revisionNumber}</h2>
					<pre>{previous.content.originalText ?? ""}</pre>
					<pre>{current.content.originalText ?? ""}</pre>
				</section>
			)}
			{permissions.includes("edit") && (
				<form action={save}>
					<h2>Editar (nova revisão a partir da {current.revisionNumber})</h2>
					<input type="hidden" name="recordId" value={fiche.recordId} />
					<input type="hidden" name="baseRevisionId" value={current.id} />
					<label>
						Fólio <input name="folio" defaultValue={current.content.folio ?? ""} />
					</label>
					<label>
						Local{" "}
						<input name="placeAsWritten" defaultValue={current.content.placeAsWritten ?? ""} />
					</label>
					<label>
						Texto original
						<textarea
							name="originalText"
							defaultValue={current.content.originalText ?? ""}
							rows={12}
						/>
					</label>
					<label>
						Notas marginais
						<textarea name="marginalNotes" defaultValue={current.content.marginalNotes ?? ""} />
					</label>
					<label>
						Nota da alteração <input name="note" />
					</label>
					<button type="submit">Guardar revisão</button>
				</form>
			)}
			<form action={decide}>
				<h2>
					Decisão sobre a revisão {current.revisionNumber} ({current.status})
				</h2>
				<input type="hidden" name="recordId" value={fiche.recordId} />
				<input type="hidden" name="revisionId" value={current.id} />
				<label>
					Nota (obrigatória ao rejeitar) <input name="note" />
				</label>
				{(["submit", "validate", "reject", "publish"] as const)
					.filter((decision) => permissions.includes(decision))
					.map((decision) => (
						<button key={decision} type="submit" name="decision" value={decision}>
							{
								{
									submit: "Submeter",
									validate: "Validar",
									reject: "Rejeitar",
									publish: "Publicar",
								}[decision]
							}
						</button>
					))}
			</form>
			<section>
				<h2>Histórico</h2>
				<ol>
					{fiche.history
						.flatMap((revision) => revision.events.map((event) => ({ revision, event })))
						.sort((a, b) => a.event.createdAt.localeCompare(b.event.createdAt))
						.map(({ revision, event }) => (
							<li key={event.id}>
								{event.createdAt} · {event.actorId} ({event.actorRole}) · {event.action}:{" "}
								{event.fromStatus ?? "—"} → {event.toStatus} · rev. {revision.revisionNumber}
								{event.note ? ` · ${event.note}` : ""}
							</li>
						))}
				</ol>
			</section>
		</main>
	);
}
