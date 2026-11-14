import type { ReactNode } from "react";
import { Brand, brandIconPath, brandName } from "./brand.tsx";
import "./globals.css";

export const metadata = {
	title: { default: brandName, template: `%s — ${brandName}` },
	icons: { icon: brandIconPath, apple: brandIconPath },
	description:
		"Arquivo histórico de Vila Caiz, Amarante: pesquisa nos assentos paroquiais e acesso ao catálogo dos livros.",
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
					<Brand />
					<a href="/catalogo">Catálogo</a>
				</nav>
				{children}
				<footer className="site-footer">
					{brandName} · Arquivo histórico de Vila Caiz, Amarante
				</footer>
			</body>
		</html>
	);
}
