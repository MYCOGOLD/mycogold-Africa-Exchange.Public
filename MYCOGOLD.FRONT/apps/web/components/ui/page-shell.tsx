import Link from "next/link";

export function PageShell({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
        <Link href="/" style={{ color: "#236b3b", fontWeight: 700, textDecoration: "none" }}>Mycogold Africa Exchange</Link>
        <nav style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <Link href="/dashboard">Dashboard</Link><Link href="/marketplace">Marketplace</Link>
          <Link href="/market">Market</Link><Link href="/tusk/overview">Tusk</Link>
        </nav>
      </header>
      <section style={{ padding: "48px 0 24px" }}><h1>{title}</h1>{description && <p>{description}</p>}</section>
      {children}
    </main>
  );
}
