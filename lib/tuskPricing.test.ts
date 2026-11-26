import test from "node:test"
import assert from "node:assert/strict"
import { askingPriceFromListings, tuskStatsForProduct, weightedPrice } from "./tuskPricing"

test("weighted asking price uses quantity and ignores invalid observations", () => {
  assert.equal(weightedPrice([
    { price: 100, quantity: 1 },
    { price: 200, quantity: 3 },
    { price: Number.POSITIVE_INFINITY, quantity: 100 },
    { price: 20, quantity: 0 },
  ]), 175)
})

test("returns null when no finite positive price and quantity pair exists", () => {
  assert.equal(weightedPrice([
    { price: Number.NaN, quantity: 2 },
    { price: 10, quantity: Number.POSITIVE_INFINITY },
    { price: 0, quantity: 5 },
  ]), null)
  assert.equal(askingPriceFromListings([]), null)
})

test("scaled calculation remains finite for large finite observations", () => {
  const value = weightedPrice([
    { price: Number.MAX_VALUE / 4, quantity: Number.MAX_VALUE / 4 },
    { price: Number.MAX_VALUE / 2, quantity: Number.MAX_VALUE / 2 },
  ])
  assert.ok(value !== null && Number.isFinite(value))
  assert.ok(value > Number.MAX_VALUE / 4)
})

test("product aliases and latest timestamp are deterministic", () => {
  const stats = tuskStatsForProduct([
    { product: "Oyster Mushroom", price: 500, quantity: 2, created_at: "2026-11-24T10:00:00Z" },
    { category: "Button mushrooms", price: 700, quantity: 1, created_at: "2026-11-25T10:00:00Z" },
    { product: "Tomato", price: 80, quantity: 10, created_at: "2026-11-26T10:00:00Z" },
  ], "mushroom")
  assert.equal(stats.count, 2)
  assert.equal(stats.totalKg, 3)
  assert.equal(stats.weighted, 560)
  assert.equal(stats.min, 500)
  assert.equal(stats.max, 700)
  assert.equal(stats.lastUpdated, "2026-11-25T10:00:00Z")
})
