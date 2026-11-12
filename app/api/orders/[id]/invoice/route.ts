import { requireKyc } from "../../../../../lib/mycg/mycogoldKyc";
import { listOrders } from "../../../../../lib/mycg/mycogoldOrders";

export async function POST(request: Request) {
  const { orderId, buyerId, quantity, transportFee } = await request.json();
  if (!buyerId) return Response.json({ error: "KYC_REQUIRED" }, { status: 400 });
  try { requireKyc(buyerId); } catch { return Response.json({ error: "KYC_REQUIRED" }, { status: 403 }); }
  const order = listOrders("ACTIVE").find(item => item.id === orderId);
  if (!order) return Response.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
  const productTotal = order.price * quantity;
  const fees = productTotal * 0.05;
  const total = productTotal + fees + transportFee;
  return Response.json({ invoice: { productTotal, fees, transportFee, total }, escrow: "READY_FOR_STK", stk: { stub: true, message: "STK Push would trigger here - DORMANT, no real M-Pesa" } });
}