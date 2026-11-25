import test from 'node:test'
import assert from 'node:assert/strict'
import {
  OrderContractError,
  parseCreateLimitOrderRequest,
} from './order-contract'

const now = 1_800_000_000_000
const valid = {
  side: 'BUY',
  commodityCode: 'TOMATO',
  gradeCode: 'GRADE_1',
  marketCode: 'NAIROBI',
  limitPriceKesCentsPerKg: 12_500,
  quantityGrams: 25_000,
  expiresAtEpochMs: now + 60_000,
  idempotencyKey: 'client-order-retry-0001',
}

test('accepts a canonical limit order payload', () => {
  assert.deepEqual(parseCreateLimitOrderRequest(valid, now), valid)
})

test('rejects unknown client-supplied authority fields', () => {
  assert.throws(
    () => parseCreateLimitOrderRequest({ ...valid, prioritySequence: 1 }, now),
    (error: unknown) => error instanceof OrderContractError && error.code === 'UNKNOWN_FIELD',
  )
})

test('rejects client-supplied actor identity', () => {
  assert.throws(
    () => parseCreateLimitOrderRequest({ ...valid, userId: 'attacker-id' }, now),
    (error: unknown) => error instanceof OrderContractError && error.code === 'UNKNOWN_FIELD',
  )
})

test('rejects floating point and non-positive prices', () => {
  for (const limitPriceKesCentsPerKg of [0, -1, 12.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(
      () => parseCreateLimitOrderRequest({ ...valid, limitPriceKesCentsPerKg }, now),
      (error: unknown) => error instanceof OrderContractError && error.code === 'INVALID_PRICE',
    )
  }
})

test('rejects invalid quantities', () => {
  for (const quantityGrams of [0, -1, 1.25, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(
      () => parseCreateLimitOrderRequest({ ...valid, quantityGrams }, now),
      (error: unknown) => error instanceof OrderContractError && error.code === 'INVALID_QUANTITY',
    )
  }
})

test('rejects non-canonical codes and unsupported side', () => {
  assert.throws(
    () => parseCreateLimitOrderRequest({ ...valid, commodityCode: 'tomato' }, now),
    (error: unknown) => error instanceof OrderContractError && error.code === 'INVALID_CODE',
  )
  assert.throws(
    () => parseCreateLimitOrderRequest({ ...valid, side: 'MARKET' }, now),
    (error: unknown) => error instanceof OrderContractError && error.code === 'INVALID_SIDE',
  )
})

test('rejects expired or non-integer expiry timestamps', () => {
  for (const expiresAtEpochMs of [now, now - 1, now + 1.5]) {
    assert.throws(
      () => parseCreateLimitOrderRequest({ ...valid, expiresAtEpochMs }, now),
      (error: unknown) => error instanceof OrderContractError && error.code === 'INVALID_EXPIRY',
    )
  }
})

test('rejects weak idempotency keys', () => {
  assert.throws(
    () => parseCreateLimitOrderRequest({ ...valid, idempotencyKey: 'short' }, now),
    (error: unknown) => error instanceof OrderContractError && error.code === 'INVALID_IDEMPOTENCY_KEY',
  )
})

test('rejects non-object and incomplete payloads', () => {
  assert.throws(
    () => parseCreateLimitOrderRequest(null, now),
    (error: unknown) => error instanceof OrderContractError && error.code === 'INVALID_OBJECT',
  )
  const { marketCode: _marketCode, ...incomplete } = valid
  assert.throws(
    () => parseCreateLimitOrderRequest(incomplete, now),
    (error: unknown) => error instanceof OrderContractError && error.code === 'MISSING_FIELD',
  )
})
