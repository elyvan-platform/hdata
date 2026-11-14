import { ApiError, createApiClient } from "@hdata/api-client";
import { cookies } from "next/headers";
import { getEnv } from "../../env/index.ts";

export const tokenCookie = "editorial_token";

/** The editorial token lives in an httpOnly cookie: it never reaches the client bundle. */
export async function reviewClient() {
	const token = (await cookies()).get(tokenCookie)?.value;
	if (!token) return null;
	return createApiClient({ baseUrl: getEnv().API_URL }).review(token);
}

export function describeError(error: unknown): string {
	if (error instanceof ApiError) {
		if (error.isAuthError)
			return `Sem permissão ou sessão inválida (${error.status}): ${error.editorialError?.message ?? error.message}`;
		return error.editorialError?.message ?? error.message;
	}
	return error instanceof Error ? error.message : "Erro desconhecido";
}
