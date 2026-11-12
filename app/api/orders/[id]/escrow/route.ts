import { createEscrow } from "../../../../../lib/mycg/mycogoldEscrow";

export async function POST(request: Request) {
  const { orderId, buyerId, sellerId, amount } = await request.json();
  const escrow = createEscrow(orderId, buyerId, sellerId, amount);
  return Response.json({ escrow }, { status: 201 });
}