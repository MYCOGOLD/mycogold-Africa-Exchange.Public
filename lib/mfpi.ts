/**
 * Experimental MFPI mathematics only.
 *
 * No official baseline, verified transaction feed, or market-data provenance
 * is configured in this project. This module therefore refuses to publish a
 * default/genesis index. It is not a ledger, blockchain, or source of live prices.
 */

export type ConfirmedTrade = {
  id: string
  listingId: string
  price: number
  kg: number
  confirmed_at: string
}

export function weightedPriceFromTrades(trades: ConfirmedTrade[]): number | null {
  if (!trades.length) return null

  let totalKg = 0
  let weightedTotal = 0

  for (const trade of trades) {
    const price = Number(trade.price)
    const kg = Number(trade.kg)
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(kg) || kg <= 0) {
      return null
    }
    totalKg += kg
    weightedTotal += price * kg
  }

  if (!Number.isFinite(totalKg) || totalKg <= 0) return null
  return weightedTotal / totalKg
}

/**
 * Calculate only when an independently verified base index and base price
 * have been supplied by a trusted data pipeline. No values are invented.
 */
export function calculateMFPI(
  verifiedTrades: ConfirmedTrade[],
  baseIndex?: number,
  baseWeightedPrice?: number,
) {
  const weighted = weightedPriceFromTrades(verifiedTrades)
  if (
    weighted === null ||
    !Number.isFinite(baseIndex) ||
    !Number.isFinite(baseWeightedPrice) ||
    Number(baseWeightedPrice) <= 0
  ) {
    return {
      mfpi: null,
      weighted,
      tick: verifiedTrades.length,
      isPublished: false,
    }
  }

  return {
    mfpi: Number(baseIndex) + ((weighted - Number(baseWeightedPrice)) / Number(baseWeightedPrice)) * 100,
    weighted,
    tick: verifiedTrades.length,
    isPublished: true,
  }
}
