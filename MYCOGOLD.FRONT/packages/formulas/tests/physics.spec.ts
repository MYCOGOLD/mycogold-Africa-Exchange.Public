import assert from "node:assert/strict";
import test from "node:test";
import { estimateTravelHours, estimateTransportCost } from "../src/physics";

test("estimates transport fuel cost", () => {
  assert.equal(estimateTransportCost({ distanceKm: 100, fuelLitresPerKm: 0.2, fuelPrice: 2, loadKg: 500 }), 40);
});

test("rejects an impossible transport estimate", () => {
  assert.throws(() => estimateTravelHours(100, 0), /speed must be positive/);
});
