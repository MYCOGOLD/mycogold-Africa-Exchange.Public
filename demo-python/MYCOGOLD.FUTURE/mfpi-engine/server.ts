/**
 * DISABLED PROTOTYPE.
 *
 * The previous implementation generated pseudo-random ticks and labelled
 * them as live MFPI. It was not backed by observed transactions or a verified
 * market-data source. Do not publish these values or connect this module to
 * the public exchange.
 */
export const MFPI_ENGINE_STATUS = 'DISABLED_SYNTHETIC_PROTOTYPE'

export function startMfpiEngine(): never {
  throw new Error(
    'MFPI engine is disabled: a verified transaction-derived market-data pipeline is not implemented.',
  )
}
