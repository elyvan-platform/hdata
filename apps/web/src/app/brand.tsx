// Brand assets live in public/brand: memoria-de-caiz-icone.png (symbol) and
// memoria-de-caiz-texto.png (wordmark), both transparent PNGs.
export const brandName = "Memória de Caiz";
export const brandIconPath = "/brand/memoria-de-caiz-icone.png";
const brandTextPath = "/brand/memoria-de-caiz-texto.png";

// The link carries the accessible name; the images are decorative so it is read once.
export function Brand() {
	return (
		<a className="brand" href="/" aria-label={`${brandName} — página inicial`}>
			<img className="brand-icon" src={brandIconPath} width={398} height={311} alt="" />
			<img className="brand-text" src={brandTextPath} width={1632} height={194} alt="" />
		</a>
	);
}
