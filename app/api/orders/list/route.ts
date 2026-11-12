import { freshnessEstimate, listOrders } from "../../../../lib/mycg/mycogoldOrders";

export async function GET(request: Request) {
  const status = new URL(request.url).searchParams.get("status") ?? "ACTIVE";
  if (status !== "ACTIVE" && status !== "PAST") return Response.json({ error: "INVALID_STATUS" }, { status: 400 });
  const orders = listOrders(status).map(order => ({ ...order, ...freshnessEstimate(order) }));
  return Response.json({ orders });
}