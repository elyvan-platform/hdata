import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { tokenCookie } from "../session.ts";

export const dynamic = "force-dynamic";

async function signIn(form: FormData) {
	"use server";
	const token = form.get("token");
	if (typeof token !== "string" || token.length === 0) redirect("/revisao/entrar");
	(await cookies()).set(tokenCookie, token, {
		httpOnly: true,
		sameSite: "strict",
		secure: process.env.NODE_ENV === "production",
		path: "/revisao",
	});
	redirect("/revisao");
}

export default function SignInPage() {
	return (
		<main>
			<h1>Entrar na revisão editorial</h1>
			<form action={signIn}>
				<label>
					Token pessoal <input name="token" type="password" required autoComplete="off" />
				</label>
				<button type="submit">Entrar</button>
			</form>
		</main>
	);
}
