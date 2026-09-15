import Link from "next/link";

const listings = [
  { product: "Tomatoes", location: "Arusha, Tanzania", quantity: "500 kg", price: "TZS 2,000/kg" },
  { product: "Avocados", location: "Murang'a, Kenya", quantity: "1,200 kg", price: "KES 85/kg" },
  { product: "Oyster mushrooms", location: "Kampala, Uganda", quantity: "80 kg", price: "UGX 12,000/kg" }
];

export default function MarketplacePage() {
  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
      <Link href="/">← Home</Link>
      <h1>Marketplace</h1>
      <p>Browse available produce by product, location, quantity, and asking price.</p>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {listings.map((listing) => (
          <article key={`${listing.product}-${listing.location}`} style={{ background: "white", border: "1px solid #d9e2d5", borderRadius: 12, padding: 20 }}>
            <p style={{ color: "#236b3b", fontWeight: 700 }}>{listing.location}</p>
            <h2>{listing.product}</h2>
            <p>{listing.quantity}</p>
            <strong>{listing.price}</strong>
            <p><Link href="/tusk">Ask Tusk about this listing →</Link></p>
          </article>
        ))}
      </div>
    </main>
  );
}
