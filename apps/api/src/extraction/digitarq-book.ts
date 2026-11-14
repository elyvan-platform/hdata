import type { Pool } from "pg";
import { z } from "zod";

const origin = "https://digitarq.arquivos.pt";
const pageList = z.object({
	fromIndex: z.number().int().nonnegative(),
	total: z.number().int().nonnegative(),
	results: z.array(z.object({ id: z.string().regex(/^\d+$/), type: z.string() })),
});

export async function discoverBookPages(viewer: string, offset: number, limit: number) {
	const url = new URL(viewer);
	const match = /^\/fileViewer\/([a-f0-9]{32})$/i.exec(url.pathname);
	if (url.origin !== origin || !match) throw new Error("Invalid official Digitarq viewer URL");
	const response = await fetch(
		`${origin}/api/rdigital/${match[1]}?fromIndex=${offset}&max=${limit}`,
		{
			redirect: "error",
			signal: AbortSignal.timeout(15_000),
		},
	);
	if (!response.ok) throw new Error(`Digitarq page listing returned HTTP ${response.status}`);
	const list = pageList.parse(await response.json());
	if (
		list.fromIndex !== offset ||
		list.results.length !== Math.min(limit, Math.max(0, list.total - offset))
	)
		throw new Error("Digitarq returned an unexpected page range");
	if (new Set(list.results.map((page) => page.id)).size !== list.results.length)
		throw new Error("Digitarq returned duplicate file IDs");
	return {
		total: list.total,
		pages: list.results.flatMap((page, index) => {
			if (page.type !== "IMAGE") return [];
			const source = new URL(url);
			source.searchParams.set("selectedFile", page.id);
			source.searchParams.set("fileType", "IMAGE");
			return [
				{
					externalId: page.id,
					sequence: offset + index + 1,
					imageUrl: `${origin}/api/rdigital/dissemination?fileId=${page.id}`,
					viewerUrl: source.href,
				},
			];
		}),
	};
}

export async function registerBookPage(
	pool: Pool,
	book: { id: string; source_id: string },
	page: Awaited<ReturnType<typeof discoverBookPages>>["pages"][number],
) {
	const result = await pool.query<{ id: string }>(
		`INSERT INTO image_ref (source_id, book_id, external_id, sequence, url, rights_status)
		 VALUES ($1,$2,$3,$4,$5,'authorized')
		 ON CONFLICT (source_id, external_id) WHERE external_id IS NOT NULL
		 DO UPDATE SET url=EXCLUDED.url
		 WHERE image_ref.book_id=EXCLUDED.book_id AND image_ref.sequence=EXCLUDED.sequence
		   AND image_ref.rights_status='authorized'
		 RETURNING id`,
		[book.source_id, book.id, page.externalId, page.sequence, page.imageUrl],
	);
	const image = result.rows[0];
	if (!image)
		throw new Error(`File ${page.externalId} conflicts with an existing image or rights decision`);
	return image.id;
}
