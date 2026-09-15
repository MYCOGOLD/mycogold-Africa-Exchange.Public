import Link from "next/link";

const categories = ["Fresh produce", "Fruits", "Vegetables", "Mushrooms", "Grains", "Livestock"];

export default function HomePage() {
  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24 }}>
        <strong style={{ color: "#236b3b", fontSize: 22 }}>Mycogold Africa Exchange</strong>
        <nav style={{ display: "flex", gap: 16 }}>
          <Link href="/marketplace">Marketplace</Link>
          <Link href="/market">Daily market</Link>
          <Link href="/tusk">Ask Tusk</Link>
        </nav>
      </header>
      <section style={{ padding: "96px 0 56px", maxWidth: 720 }}>
        <p style={{ color: "#236b3b", fontWeight: 700 }}>REGIONAL FARMER-TO-BUYER MARKET</p>
        <h1 style={{ fontSize: "clamp(40px, 7vw, 76px)", lineHeight: 1.02, margin: "16px 0" }}>
          Grow trade across Africa.
        </h1>
        <p style={{ fontSize: 20, lineHeight: 1.6 }}>
          List produce, chat with buyers, agree trades informally, and see transparent regional prices.
        </p>
        <Link href="/marketplace" style={{ display: "inline-block", background: "#236b3b", color: "white", padding: "14px 20px", borderRadius: 8, textDecoration: "none", fontWeight: 700 }}>
          Explore marketplace
        </Link>
      </section>
      <section>
        <h2>Market categories</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {categories.map((category) => <span key={category} style={{ background: "white", border: "1px solid #d9e2d5", borderRadius: 24, padding: "10px 16px" }}>{category}</span>)}
        </div>
      </section>
    </main>
  );
}
