export type Escrow = {
  orderId: string;
  buyerId: string;
  sellerId: string;
  transporterId: string;
  amount: number;
  status: "LOCKED" | "RELEASED" | "RECONCILIATION";
  locationEnabled: boolean;
  powScore: number;
};

const escrows = new Map<string, Escrow>();

export function createEscrow(orderId: string, buyerId: string, sellerId: string, amount: number): Escrow {
  const escrow: Escrow = { orderId, buyerId, sellerId, transporterId: "", amount, status: "LOCKED", locationEnabled: true, powScore: 0 };
  escrows.set(orderId, escrow);
  return escrow;
}

export function getEscrow(orderId: string): Escrow | undefined {
  return escrows.get(orderId);
}

export function calculatePoW(input: { sellerMedia: boolean; pickupPhotos: boolean; arrivalPhotos: boolean; buyerConfirmVideo: boolean; locationVerified: boolean; scanPassed: boolean }): number {
  const points = [input.sellerMedia, input.pickupPhotos, input.arrivalPhotos, input.buyerConfirmVideo, input.locationVerified].filter(Boolean).length * 15 + (input.scanPassed ? 25 : 0);
  return points < 70 ? 0 : points;
}

export function releaseEscrow(escrow: Escrow, powScore: number) {
  if (escrow.status !== "LOCKED") throw new Error("ESCROW_NOT_LOCKED");
  if (powScore < 70) { escrow.status = "RECONCILIATION"; throw new Error("POW_INSUFFICIENT_RECONCILIATION"); }
  escrow.powScore = powScore;
  escrow.status = "RELEASED";
  const tokens = { seller: powScore * 0.5, buyer: powScore * 0.3, transporter: powScore * 0.2 };
  return { escrow, tokens };
}

export function startReconciliation(orderId: string, reason: string): Escrow {
  void reason;
  const escrow = escrows.get(orderId);
  if (!escrow) throw new Error("ESCROW_NOT_FOUND");
  escrow.status = "RECONCILIATION";
  escrow.locationEnabled = true;
  return escrow;
}