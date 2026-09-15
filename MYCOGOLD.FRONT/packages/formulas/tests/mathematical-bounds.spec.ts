import assert from "node:assert/strict";
import test from "node:test";
import { clamp, weightedAveragePrice } from "../src";

test("clamps index values to a declared range", () => {
  assert.equal(clamp(120, 0, 100), 100);
  assert.equal(clamp(-5, 0, 100), 0);
});

test("keeps weighted prices within the observed trade range", () => {
  const price = weightedAveragePrice([{ price: 100, volume: 1 }, { price: 200, volume: 3 }]);
  assert.ok(price >= 100 && price <= 200);
  assert.equal(price, 175);
});
