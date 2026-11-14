import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
	title: "Memória de Vila Caiz",
	description: "Pesquisa nos assentos paroquiais de Vila Caiz e acesso ao catálogo dos livros.",
};

export const viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="pt">
			<body>
				<a className="skip-link" href="#conteudo">
					Saltar para o conteúdo
				</a>
				<nav className="site-nav" aria-label="Principal">
					<a href="/">Memória de Vila Caiz</a>
					<a href="/catalogo">Catálogo</a>
				</nav>
				{children}
			</body>
		</html>
	);
}
