import { calculatePoW, getEscrow, releaseEscrow, startReconciliation } from "../../../../../lib/mycg/mycogoldEscrow";

export async function POST(request: Request) {
  const { orderId, buyerVideo, buyerPhotos } = await request.json();
  if (!buyerVideo || !Array.isArray(buyerPhotos) || buyerPhotos.length < 1) {
    if (getEscrow(orderId)) startReconciliation(orderId, "BUYER_CONFIRM_MISSING");
    return Response.json({ status: "RECONCILIATION", reason: "BUYER_CONFIRM_MISSING", escrowLocked: true });
  }
  const escrow = getEscrow(orderId);
  if (!escrow) return Response.json({ error: "ESCROW_NOT_FOUND" }, { status: 404 });
  const powScore = calculatePoW({ sellerMedia: true, pickupPhotos: true, arrivalPhotos: true, buyerConfirmVideo: true, locationVerified: true, scanPassed: true });
  try {
    const { tokens } = releaseEscrow(escrow, powScore);
    return Response.json({ status: "RELEASED", powScore, tokens });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "ESCROW_RELEASE_FAILED" }, { status: 409 });
  }
}