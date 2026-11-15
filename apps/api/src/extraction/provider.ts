import { createHash } from "node:crypto";
import { illegibleMarker, modelOutputSchema } from "@hdata/domain";
import sharp from "sharp";
import { z } from "zod";

export type LoadedImage = { bytes: Uint8Array; mediaType: string; sha256: string };
export type ImageLoader = (image: {
	url: string | null;
	storageKey: string | null;
}) => Promise<LoadedImage>;

/** Raised for failures a retry cannot fix (bad image, malformed model output). */
export class PermanentExtractionError extends Error {
	readonly code: string;
	constructor(code: string, message: string) {
		super(message);
		this.name = "PermanentExtractionError";
		this.code = code;
	}
}

/** Raised for failures worth retrying (network, 5xx, rate limit). */
export class TransientExtractionError extends Error {
	readonly code: string;
	constructor(code: string, message: string) {
		super(message);
		this.name = "TransientExtractionError";
		this.code = code;
	}
}

export type ModelProvider = {
	model: string;
	/** Pinned model identifier or snapshot, stored with every run. */
	version: string;
	promptVersion: string;
	/** Returns the raw model output; the service validates it against `modelOutputSchema`. */
	extract(image: LoadedImage): Promise<unknown>;
};

const maxImageBytes = 20 * 1024 * 1024;

/** Loads a public image over HTTP. Stored objects (`storageKey`) need a storage-backed loader. */
export function createUrlImageLoader(options: { timeoutMs: number; fetch?: typeof fetch }) {
	const doFetch = options.fetch ?? fetch;
	const loader: ImageLoader = async ({ url }) => {
		if (!url) throw new PermanentExtractionError("image_unavailable", "Image has no public URL");
		let response: Response;
		try {
			response = await doFetch(url, { signal: AbortSignal.timeout(options.timeoutMs) });
		} catch (error) {
			throw new TransientExtractionError("image_fetch_failed", String(error));
		}
		if (!response.ok) {
			const make =
				response.status >= 500 || response.status === 429
					? TransientExtractionError
					: PermanentExtractionError;
			throw new make("image_fetch_failed", `Image request answered ${response.status}`);
		}
		let mediaType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
		if (!["image/jpeg", "image/png", "image/webp", "image/tiff"].includes(mediaType))
			throw new PermanentExtractionError("image_type", `Unsupported media type "${mediaType}"`);
		const reader = response.body?.getReader();
		if (!reader) throw new PermanentExtractionError("image_size", "Image response is empty");
		const chunks: Uint8Array[] = [];
		let length = 0;
		for (;;) {
			const chunk = await reader.read();
			if (chunk.done) break;
			length += chunk.value.length;
			if (length > maxImageBytes) {
				await reader.cancel();
				throw new PermanentExtractionError("image_size", "Image exceeds the download limit");
			}
			chunks.push(chunk.value);
		}
		let bytes = Buffer.concat(chunks);
		const sha256 = createHash("sha256").update(bytes).digest("hex");
		if (bytes.length === 0 || bytes.length > maxImageBytes)
			throw new PermanentExtractionError("image_size", `Image size ${bytes.length} is not allowed`);
		if (mediaType === "image/tiff") {
			try {
				bytes = await sharp(bytes, { limitInputPixels: 60_000_000 })
					.resize({ width: 3200, height: 3200, fit: "inside", withoutEnlargement: true })
					.jpeg({ quality: 90 })
					.toBuffer();
				mediaType = "image/jpeg";
			} catch {
				throw new PermanentExtractionError("image_type", "TIFF could not be converted to JPEG");
			}
		}
		return { bytes, mediaType, sha256 };
	};
	return loader;
}

export const promptVersion = "seats-v2";

const systemPrompt = `Transcreve assentos paroquiais manuscritos (português, séculos XVI–XIX).
Regras: mantém a grafia original, sem modernizar nem expandir abreviaturas; um item por assento, pela ordem da página;
escreve ${illegibleMarker} no lugar de qualquer palavra que não consigas ler com segurança e nunca adivinhes;
para cada campo indica "confidence" entre 0 e 1 (a tua estimativa, não uma probabilidade calibrada);
"region" é a caixa do assento em coordenadas normalizadas {x,y,w,h} (0–1) ou null.
Usa o schema de saída. Campos opcionais ausentes têm valor null. Ignora capas, folhas em branco, cotas e notas que não sejam assentos. Nesses casos devolve {"seats":[]}.`;

const structuredOutput = z.toJSONSchema(modelOutputSchema);
delete structuredOutput.$schema;
function requireProperties(schema: object) {
	Reflect.deleteProperty(schema, "default");
	if ("properties" in schema && schema.properties && typeof schema.properties === "object") {
		const required = new Set(
			"required" in schema && Array.isArray(schema.required) ? schema.required : [],
		);
		for (const [key, value] of Object.entries(schema.properties)) {
			if (!required.has(key))
				Object.assign(schema.properties, { [key]: { anyOf: [value, { type: "null" }] } });
		}
		Object.assign(schema, { required: Object.keys(schema.properties) });
	}
	for (const value of Object.values(schema))
		if (value && typeof value === "object") requireProperties(value);
}
requireProperties(structuredOutput);

/** OpenRouter Chat Completions API provider; the key never leaves the server. */
export function createOpenRouterProvider(options: {
	apiKey: string;
	model: string;
	timeoutMs: number;
	fetch?: typeof fetch;
}): ModelProvider {
	const doFetch = options.fetch ?? fetch;
	async function extractImage(image: LoadedImage) {
		let response: Response;
		try {
			response = await doFetch("https://openrouter.ai/api/v1/chat/completions", {
				method: "POST",
				signal: AbortSignal.timeout(options.timeoutMs),
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${options.apiKey}`,
				},
				body: JSON.stringify({
					model: options.model,
					max_tokens: 8192,
					provider: { require_parameters: true },
					response_format: {
						type: "json_schema",
						json_schema: { name: "parish_records", strict: true, schema: structuredOutput },
					},
					messages: [
						{ role: "system", content: systemPrompt },
						{
							role: "user",
							content: [
								{ type: "text", text: "Transcreve os assentos desta página." },
								{
									type: "image_url",
									image_url: {
										url: `data:${image.mediaType};base64,${Buffer.from(image.bytes).toString("base64")}`,
									},
								},
							],
						},
					],
				}),
			});
		} catch (error) {
			throw new TransientExtractionError("model_request_failed", String(error));
		}
		if (!response.ok) {
			const transient = response.status >= 500 || response.status === 429;
			const make = transient ? TransientExtractionError : PermanentExtractionError;
			throw new make("model_http_error", `Model API answered ${response.status}`);
		}
		let body: unknown;
		try {
			body = await response.json();
		} catch {
			throw new PermanentExtractionError("model_invalid_json", "Model response is not valid JSON");
		}
		const parsed = z
			.object({
				choices: z.array(
					z.object({
						finish_reason: z.string().nullable().optional(),
						message: z.object({ content: z.string().nullable() }).optional(),
					}),
				),
			})
			.safeParse(body);
		const choice = parsed.success ? parsed.data.choices[0] : undefined;
		if (choice?.finish_reason === "length")
			throw new PermanentExtractionError("model_truncated", "Model reached its output limit");
		const text = choice?.message?.content;
		if (!text) throw new PermanentExtractionError("model_empty", "Model returned no text");
		try {
			const payload: unknown = JSON.parse(
				text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""),
				(key, value) =>
					value === null && ["normalizedName", "roleAsWritten", "notes"].includes(key)
						? undefined
						: value,
			);
			return payload;
		} catch {
			throw new PermanentExtractionError("model_invalid_json", "Model output is not valid JSON");
		}
	}
	return {
		model: "openrouter",
		version: options.model,
		promptVersion,
		async extract(image) {
			try {
				return await extractImage(image);
			} catch (error) {
				if (!(error instanceof PermanentExtractionError) || error.code !== "model_truncated")
					throw error;
			}
			const original = sharp(Buffer.from(image.bytes), { limitInputPixels: 60_000_000 });
			const { width, height } = await original.metadata();
			if (width < 2 || height < 2)
				throw new PermanentExtractionError("model_truncated", "Image cannot be split");
			const horizontal = width >= height;
			const half = Math.floor((horizontal ? width : height) / 2);
			const seats: z.infer<typeof modelOutputSchema>["seats"] = [];
			for (const start of [0, half]) {
				const area = horizontal
					? { left: start, top: 0, width: start ? width - half : half, height }
					: { left: 0, top: start, width, height: start ? height - half : half };
				const bytes = await original.clone().extract(area).jpeg({ quality: 92 }).toBuffer();
				const part = modelOutputSchema.safeParse(
					await extractImage({ ...image, bytes, mediaType: "image/jpeg" }),
				);
				if (!part.success)
					throw new PermanentExtractionError(
						"model_schema",
						"Split response does not match the schema",
					);
				for (const seat of part.data.seats) {
					const r = seat.region;
					seats.push({
						...seat,
						region: r
							? {
									x: (area.left + r.x * area.width) / width,
									y: (area.top + r.y * area.height) / height,
									w: (r.w * area.width) / width,
									h: (r.h * area.height) / height,
								}
							: null,
					});
				}
			}
			return { seats };
		},
	};
}
