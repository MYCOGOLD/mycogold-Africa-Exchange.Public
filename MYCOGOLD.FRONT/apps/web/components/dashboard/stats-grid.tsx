export function StatsGrid({ stats }: { stats: { label: string; value: string }[] }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
    {stats.map((stat) => <div key={stat.label} style={{ background: "white", border: "1px solid #d9e2d5", borderRadius: 10, padding: 18 }}><small>{stat.label}</small><h2 style={{ marginBottom: 0 }}>{stat.value}</h2></div>)}
  </div>;
}
