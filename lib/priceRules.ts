/**
 * Seller asking prices are market inputs, not values to be rejected by a
 * universal minimum. Validate only finite positive amounts here; benchmark,
 * fraud, and anomaly checks must use commodity-, grade-, unit-, and location-
 * aware rules backed by real reference data.
 */
export function validatePositivePrice(price: number, currency: 'USD' | 'KES' = 'KES') {
  const value = Number(price)
  const ok = Number.isFinite(value) && value > 0
  return {
    ok,
    floor: 0,
    currency,
    message: ok ? null : 'Enter a valid price greater than zero.',
  }
}

export function formatPrice(price: number, currency = 'KES') {
  const value = Number(price)
  return Number.isFinite(value) ? `${currency} ${value.toFixed(2)}` : 'Price unavailable'
}

export function formatMFPI(value: number) {
  return Number.isFinite(value) ? value.toFixed(5) : '—'
}
