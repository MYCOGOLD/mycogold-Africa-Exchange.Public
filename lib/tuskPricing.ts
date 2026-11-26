/**
 * Seller-listing price analytics for TUSK.
 *
 * These calculations describe asking prices only. They are not trade prices,
 * settlement values, or the verified MFPI.
 */
export type PriceListing = {
  product?: string | null
  category?: string | null
  price?: number | null
  quantity?: number | null
  location?: string | null
  created_at?: string | null
}

export type ProductPriceStats = {
  count: number
  totalKg: number
  weighted: number | null
  min: number | null
  max: number | null
  lastUpdated: string | null
  items: PriceListing[]
}

const aliases: Record<string, readonly string[]> = {
  kales: ['kales', 'sukuma'],
  potatoes: ['potatoes', 'viazi'],
  onions: ['onions', 'kitunguu'],
  mushroom: ['mushroom', 'oyster', 'button'],
  cereals: ['cereals', 'maize', 'beans', 'rice'],
}

function positiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/**
 * Calculate a quantity-weighted mean without multiplying raw price * weight.
 * Scaling both dimensions avoids avoidable intermediate overflow for large
 * but finite imported values.
 */
export function weightedPrice(listings: readonly PriceListing[]): number | null {
  let maxPrice = 0
  let maxQuantity = 0
  const valid: Array<{ price: number; quantity: number }> = []

  for (const item of listings) {
    if (!positiveFinite(item.price) || !positiveFinite(item.quantity)) continue
    valid.push({ price: item.price, quantity: item.quantity })
    maxPrice = Math.max(maxPrice, item.price)
    maxQuantity = Math.max(maxQuantity, item.quantity)
  }

  if (valid.length === 0 || maxPrice === 0 || maxQuantity === 0) return null

  let scaledWeight = 0
  let scaledValue = 0
  for (const item of valid) {
    const weight = item.quantity / maxQuantity
    scaledWeight += weight
    scaledValue += (item.price / maxPrice) * weight
  }

  const result = (scaledValue / scaledWeight) * maxPrice
  return Number.isFinite(result) && result > 0 ? result : null
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').normalize('NFKC').trim().toLocaleLowerCase()
}

function latestTimestamp(items: readonly PriceListing[]): string | null {
  let latestTime = Number.NEGATIVE_INFINITY
  let latestValue: string | null = null

  for (const item of items) {
    if (!item.created_at) continue
    const timestamp = Date.parse(item.created_at)
    if (Number.isFinite(timestamp) && timestamp > latestTime) {
      latestTime = timestamp
      latestValue = item.created_at
    }
  }
  return latestValue
}

export function tuskStatsForProduct(
  all: readonly PriceListing[],
  product: string,
): ProductPriceStats {
  const normalized = normalize(product)
  const terms = aliases[normalized] ?? (normalized ? [normalized] : [])
  const items = all.filter((item) => {
    const haystack = `${normalize(item.product)} ${normalize(item.category)}`
    return terms.some((term) => haystack.includes(term))
  })
  const prices = items
    .map((item) => item.price)
    .filter(positiveFinite)
  const quantities = items
    .map((item) => item.quantity)
    .filter(positiveFinite)

  return {
    count: items.length,
    totalKg: quantities.reduce((sum, quantity) => sum + quantity, 0),
    weighted: weightedPrice(items),
    min: prices.length ? Math.min(...prices) : null,
    max: prices.length ? Math.max(...prices) : null,
    lastUpdated: latestTimestamp(items),
    items,
  }
}

/** Asking-price estimate from seller listings; never a verified MFPI. */
export function askingPriceFromListings(all: readonly PriceListing[]): number | null {
  return weightedPrice(all)
}
