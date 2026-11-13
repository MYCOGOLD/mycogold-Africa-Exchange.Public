/**
 * Experimental MFPI basket assumptions for offline modelling only.
 * These weights and anchors are not an official or verified Kenyan market index.
 * Do not expose them as current market prices.
 */
export const MFPI_MODE = 'OFFLINE_EXPERIMENTAL'
export const BASKET_WEIGHTS = {
  mushrooms: 0.30,
  grains: 0.25,
  vegetables: 0.20,
  fruits: 0.15,
  livestock: 0.10,
}
export const MFPI_CONFIG = {
  basePrice: 100,
  usdAnchor: 129,
  tickIntervalMs: 1000,
  isVerified: false,
}
