// MFPI - confirmed trades only. MYCG never affects MFPI.
// BASE_MFPI = 99.06654, BASE_WEIGHTED_PRICE = 52.00
// MFPI = 99.06654 + ((WeightedPrice - 52) / 52 * 100)
// Inputs: { price_KES, kg } from server-validated verified_trades only.
// Map verified_price_kes -> price_KES, verified_kg -> kg. Do NOT use trust_score as weight.
export const BASE_MFPI = 99.06654;
export const BASE_WEIGHTED_PRICE = 52.00;
export type ConfirmedTradeInput = { price_KES: number; kg: number };
export function weightedPriceKes(trades: ConfirmedTradeInput[]): number | null {
  if (!Array.isArray(trades) || trades.length === 0) return null;
  let totalKg = 0;
  let weightedSum = 0;
  for (const t of trades) {
    if (!Number.isFinite(t.price_KES) || !Number.isFinite(t.kg)) return null;
    if (t.price_KES <= 0 || t.kg <= 0) return null;
    totalKg += t.kg;
    weightedSum += t.price_KES * t.kg;
  }
  if (totalKg <= 0) return null;
  return weightedSum / totalKg;
}
export function mfpiFromWeightedPrice(weightedPrice: number): number | null {
  if (!Number.isFinite(weightedPrice) || weightedPrice <= 0) return null;
  return BASE_MFPI + ((weightedPrice - BASE_WEIGHTED_PRICE) / BASE_WEIGHTED_PRICE * 100);
}
export function mfpiFromConfirmedTrades(trades: ConfirmedTradeInput[]): { weighted_price_kes: number; mfpi: number } | null {
  const wp = weightedPriceKes(trades);
  if (wp === null) return null;
  const mfpi = mfpiFromWeightedPrice(wp);
  if (mfpi === null) return null;
  return { weighted_price_kes: wp, mfpi };
}
