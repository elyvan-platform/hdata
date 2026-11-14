import { createHash } from "node:crypto";
import { illegibleMarker } from "@hdata/domain";

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
		const mediaType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
		if (!["image/jpeg", "image/png", "image/webp"].includes(mediaType))
			throw new PermanentExtractionError("image_type", `Unsupported media type "${mediaType}"`);
		const bytes = new Uint8Array(await response.arrayBuffer());
		if (bytes.length === 0 || bytes.length > maxImageBytes)
			throw new PermanentExtractionError("image_size", `Image size ${bytes.length} is not allowed`);
		return { bytes, mediaType, sha256: createHash("sha256").update(bytes).digest("hex") };
	};
	return loader;
}

export const promptVersion = "seats-v1";

const systemPrompt = `Transcreve assentos paroquiais manuscritos (português, séculos XVI–XIX).
Regras: mantém a grafia original, sem modernizar nem expandir abreviaturas; um item por assento, pela ordem da página;
escreve ${illegibleMarker} no lugar de qualquer palavra que não consigas ler com segurança e nunca adivinhes;
para cada campo indica "confidence" entre 0 e 1 (a tua estimativa, não uma probabilidade calibrada);
"region" é a caixa do assento em coordenadas normalizadas {x,y,w,h} (0–1) ou null.
Responde apenas com JSON: {"seats":[{"recordType":{"value":"baptism|marriage|death|undetermined","confidence":0},
"originalText":{...},"folio":{"value":null,"confidence":0},"placeAsWritten":{...},"dateAsWritten":{...},"marginalNotes":{...},
"participants":[{"participant":{"role":"","nameAsWritten":"","legibility":"legible|uncertain|illegible","position":0},"confidence":0}],
"region":null}]}`;

/** Anthropic Messages API provider; the key never leaves the server. */
export function createAnthropicProvider(options: {
	apiKey: string;
	model: string;
	timeoutMs: number;
	fetch?: typeof fetch;
}): ModelProvider {
	const doFetch = options.fetch ?? fetch;
	return {
		model: "anthropic",
		version: options.model,
		promptVersion,
		async extract(image) {
			let response: Response;
			try {
				response = await doFetch("https://api.anthropic.com/v1/messages", {
					method: "POST",
					signal: AbortSignal.timeout(options.timeoutMs),
					headers: {
						"content-type": "application/json",
						"x-api-key": options.apiKey,
						"anthropic-version": "2023-06-01",
					},
					body: JSON.stringify({
						model: options.model,
						max_tokens: 8192,
						system: systemPrompt,
						messages: [
							{
								role: "user",
								content: [
									{
										type: "image",
										source: {
											type: "base64",
											media_type: image.mediaType,
											data: Buffer.from(image.bytes).toString("base64"),
										},
									},
									{ type: "text", text: "Transcreve os assentos desta página." },
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
			const body = (await response.json()) as { content?: { type: string; text?: string }[] };
			const text = body.content?.find((part) => part.type === "text")?.text;
			if (!text) throw new PermanentExtractionError("model_output", "Model returned no text");
			try {
				return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
			} catch {
				throw new PermanentExtractionError("model_output", "Model output is not valid JSON");
			}
		},
	};
}
