export type ExchangeOrderSide = 'BUY' | 'SELL'

export interface CreateLimitOrderRequest {
  side: ExchangeOrderSide
  commodityCode: string
  gradeCode: string
  marketCode: string
  /** Integer KES cents per kilogram. */
  limitPriceKesCentsPerKg: number
  /** Integer grams. */
  quantityGrams: number
  /** Unix epoch milliseconds. Priority sequence is assigned by the server. */
  expiresAtEpochMs: number
  /** Client-generated retry key; never use it as an order ID. */
  idempotencyKey: string
}

export type OrderContractErrorCode =
  | 'INVALID_OBJECT'
  | 'UNKNOWN_FIELD'
  | 'MISSING_FIELD'
  | 'INVALID_SIDE'
  | 'INVALID_CODE'
  | 'INVALID_PRICE'
  | 'INVALID_QUANTITY'
  | 'INVALID_EXPIRY'
  | 'INVALID_IDEMPOTENCY_KEY'

export class OrderContractError extends Error {
  readonly code: OrderContractErrorCode

  constructor(code: OrderContractErrorCode, message: string) {
    super(message)
    this.name = 'OrderContractError'
    this.code = code
  }
}

const allowedFields = new Set([
  'side',
  'commodityCode',
  'gradeCode',
  'marketCode',
  'limitPriceKesCentsPerKg',
  'quantityGrams',
  'expiresAtEpochMs',
  'idempotencyKey',
])

const codePattern = /^[A-Z0-9][A-Z0-9_-]{0,31}$/
const idempotencyPattern = /^[A-Za-z0-9._:-]{16,128}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireCode(value: unknown, field: string): string {
  if (typeof value !== 'string' || !codePattern.test(value)) {
    throw new OrderContractError('INVALID_CODE', `${field} must be a canonical uppercase code.`)
  }
  return value
}

function requirePositiveSafeInteger(value: unknown, code: 'INVALID_PRICE' | 'INVALID_QUANTITY', field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new OrderContractError(code, `${field} must be a positive safe integer.`)
  }
  return value
}

/**
 * Strictly validates the public gateway payload.
 *
 * The authenticated actor, database order ID, priority sequence, remaining
 * quantity, status, execution price and settlement totals are intentionally
 * absent: the server/database own those values.
 */
export function parseCreateLimitOrderRequest(
  value: unknown,
  nowEpochMs: number = Date.now(),
): CreateLimitOrderRequest {
  if (!isRecord(value)) {
    throw new OrderContractError('INVALID_OBJECT', 'Order request must be a JSON object.')
  }

  for (const key of Object.keys(value)) {
    if (!allowedFields.has(key)) {
      throw new OrderContractError('UNKNOWN_FIELD', `Field ${key} is not accepted.`)
    }
  }

  for (const key of allowedFields) {
    if (!(key in value)) {
      throw new OrderContractError('MISSING_FIELD', `Field ${key} is required.`)
    }
  }

  if (value.side !== 'BUY' && value.side !== 'SELL') {
    throw new OrderContractError('INVALID_SIDE', 'side must be BUY or SELL.')
  }

  const commodityCode = requireCode(value.commodityCode, 'commodityCode')
  const gradeCode = requireCode(value.gradeCode, 'gradeCode')
  const marketCode = requireCode(value.marketCode, 'marketCode')
  const limitPriceKesCentsPerKg = requirePositiveSafeInteger(
    value.limitPriceKesCentsPerKg,
    'INVALID_PRICE',
    'limitPriceKesCentsPerKg',
  )
  const quantityGrams = requirePositiveSafeInteger(
    value.quantityGrams,
    'INVALID_QUANTITY',
    'quantityGrams',
  )

  if (
    typeof nowEpochMs !== 'number' ||
    !Number.isSafeInteger(nowEpochMs) ||
    nowEpochMs <= 0 ||
    typeof value.expiresAtEpochMs !== 'number' ||
    !Number.isSafeInteger(value.expiresAtEpochMs) ||
    value.expiresAtEpochMs <= nowEpochMs
  ) {
    throw new OrderContractError('INVALID_EXPIRY', 'expiresAtEpochMs must be a future Unix timestamp in milliseconds.')
  }

  if (typeof value.idempotencyKey !== 'string' || !idempotencyPattern.test(value.idempotencyKey)) {
    throw new OrderContractError(
      'INVALID_IDEMPOTENCY_KEY',
      'idempotencyKey must contain 16–128 letters, digits, dots, underscores, colons or hyphens.',
    )
  }

  return {
    side: value.side,
    commodityCode,
    gradeCode,
    marketCode,
    limitPriceKesCentsPerKg,
    quantityGrams,
    expiresAtEpochMs: value.expiresAtEpochMs,
    idempotencyKey: value.idempotencyKey,
  }
}
