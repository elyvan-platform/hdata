"use client";

import { useActionState } from "react";

export function RefreshForm({
	action,
}: {
	action: (previous: string, form: FormData) => Promise<string>;
}) {
	const [message, submit, pending] = useActionState(action, "");

	return (
		<>
			<form className="card" action={submit}>
				<div>
					<label htmlFor="token">Token de atualização</label>
					<input
						id="token"
						name="token"
						type="password"
						autoComplete="off"
						minLength={16}
						maxLength={1024}
						required
					/>
				</div>
				<button type="submit" disabled={pending}>
					{pending ? "A atualizar…" : "Atualizar catálogo"}
				</button>
			</form>
			<p role="status">{pending ? "A consultar o Digitarq…" : message}</p>
		</>
	);
}
