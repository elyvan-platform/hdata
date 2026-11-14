import type { SearchResult } from "@hdata/domain";

const legibilityNote = { legible: "", uncertain: " (leitura incerta)", illegible: " (ilegível)" };

export function Participants({ record }: { record: SearchResult }) {
	if (record.participants.length === 0)
		return <p className="muted">Sem participantes registados.</p>;
	return (
		<ul>
			{record.participants.map((p) => (
				<li key={`${p.role}-${p.name}`}>
					{p.role}: <span lang="pt">{p.name}</span>
					{legibilityNote[p.legibility]}
				</li>
			))}
		</ul>
	);
}
