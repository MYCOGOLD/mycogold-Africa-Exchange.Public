import { PageShell } from "../../components/ui/page-shell";
import { StatsGrid } from "../../components/dashboard/stats-grid";
export default function DashboardPage() { return <PageShell title="Your exchange dashboard" description="A single view of trade activity, market signals, and Tusk recommendations."><StatsGrid stats={[{ label: "Active listings", value: "24" }, { label: "Open conversations", value: "8" }, { label: "Orders this month", value: "17" }, { label: "Regional index", value: "1,980" }]} /></PageShell>; }
