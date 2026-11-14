import type { ReactNode } from "react";

export const metadata = { title: "hdata" };

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="pt">
			<body>{children}</body>
		</html>
	);
}
