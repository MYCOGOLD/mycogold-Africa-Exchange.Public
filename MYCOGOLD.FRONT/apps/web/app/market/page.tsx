import Link from "next/link";

export default function MarketPage() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px" }}>
      <Link href="/">← Home</Link>
      <h1>Mycogold Africa market</h1>
      <p>Verified completed trades are weighted by traded volume. Asking prices do not enter the index until a trade is completed.</p>
      <section style={{ background: "white", border: "1px solid #d9e2d5", borderRadius: 12, padding: 24 }}>
        <h2>Today&apos;s regional snapshot</h2>
        <p>Tomatoes · Arusha, Tanzania</p>
        <strong style={{ fontSize: 32 }}>TZS 1,980/kg</strong>
        <p>12 completed trades · 4,800 kg traded · Confidence: medium</p>
      </section>
    </main>
  );
}
