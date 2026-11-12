type Tokens = { seller: number; buyer: number; transporter: number };
type PoWv2Result = { powScore: number; tokens: Tokens; fineSeller: boolean; reason?: string };

export function calculatePoWv2(input: {
  scanPassed: boolean; transporterProof: boolean; buyerConfirm: boolean;
  commentsScore: 1 | 2 | 3 | 4 | 5; deliveryHours: number; expectedHours: number; isBadOrder: boolean;
}): PoWv2Result {
  if (input.isBadOrder) return { powScore: 0, tokens: { seller: 0, buyer: 0, transporter: 0 }, fineSeller: true, reason: "BAD_ORDER_FINE_SELLER" };
  let powScore = 100;
  if (input.commentsScore <= 2) powScore -= 20;
  if (input.deliveryHours > input.expectedHours) powScore -= 30;
  if (!input.buyerConfirm) powScore -= 100;
  if (powScore < 50) return { powScore, tokens: { seller: 0, buyer: 0, transporter: 0 }, fineSeller: false, reason: "POOR_ORDER_MIN_TOKENS" };
  return { powScore, tokens: { seller: powScore * 0.5, buyer: powScore * 0.3, transporter: powScore * 0.2 }, fineSeller: false };
}