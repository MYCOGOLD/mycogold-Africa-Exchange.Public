import test from "node:test";
import assert from "node:assert/strict";
import { SimulatedAnnealingBackend, solveQubo } from "./qubo";

test("classical annealing finds a low-energy binary assignment deterministically", () => {
  const problem = {
    linear: [-2, -2, -2],
    quadratic: [
      { i: 0, j: 1, coefficient: 5 },
      { i: 1, j: 2, coefficient: 5 },
      { i: 0, j: 2, coefficient: 5 },
    ],
  };
  const a = solveQubo(problem, { iterations: 30_000, seed: 17 });
  const b = solveQubo(problem, { iterations: 30_000, seed: 17 });
  assert.deepEqual(a, b);
  assert.ok(a.energy <= -2);
  assert.equal(a.backend, "classical-simulated-annealing");
  assert.equal(a.optimalityGuaranteed, false);
});

test("rejects malformed coefficients, duplicate pairs and invalid temperatures", () => {
  const backend = new SimulatedAnnealingBackend();
  assert.throws(() => backend.solve({ linear: [Number.NaN] }));
  assert.throws(() => backend.solve({
    linear: [0, 0],
    quadratic: [{ i: 0, j: 1, coefficient: 1 }, { i: 1, j: 0, coefficient: 2 }],
  }), /unique/);
  assert.throws(() => backend.solve({ linear: [0] }, { initialTemperature: 0 }));
});

test("supports a single binary variable", () => {
  const result = solveQubo({ linear: [-1] }, { iterations: 2_000, seed: 3 });
  assert.deepEqual(result.variables, [1]);
  assert.equal(result.energy, -1);
});

test("rejects invalid iteration counts rather than returning a NaN result", () => {
  const backend = new SimulatedAnnealingBackend();
  assert.throws(() => backend.solve({ linear: [1] }, { iterations: Number.NaN }), /Iterations/);
  assert.throws(() => backend.solve({ linear: [1] }, { iterations: 0 }), /Iterations/);
});
