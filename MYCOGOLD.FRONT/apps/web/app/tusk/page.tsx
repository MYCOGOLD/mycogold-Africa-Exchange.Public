import Link from "next/link";

export default function TuskPage() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px" }}>
      <Link href="/">← Home</Link>
      <h1>Ask Tusk</h1>
      <p>Tusk helps you create listings, understand market prices, translate messages, and find relevant buyers or farmers.</p>
      <form style={{ display: "grid", gap: 12, maxWidth: 600 }}>
        <label htmlFor="question">What do you want to do?</label>
        <textarea id="question" rows={5} placeholder="Example: I have 200 kg of tomatoes in Moshi for delivery tomorrow." />
        <button type="button" style={{ width: "fit-content", background: "#236b3b", color: "white", border: 0, borderRadius: 8, padding: "12px 18px" }}>Send to Tusk</button>
      </form>
    </main>
  );
}
