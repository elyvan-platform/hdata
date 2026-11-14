import { createApiClient } from "@hdata/api-client";
import { getEnv } from "../env/index.ts";

export const dynamic = "force-dynamic";

async function apiStatus(): Promise<string> {
	try {
		const ready = await createApiClient({ baseUrl: getEnv().API_URL }).ready();
		return ready.status;
	} catch (error) {
		return `unavailable (${error instanceof Error ? error.message : "unknown error"})`;
	}
}

export default async function Home() {
	return (
		<main>
			<h1>hdata</h1>
			<p>API: {await apiStatus()}</p>
		</main>
	);
}
