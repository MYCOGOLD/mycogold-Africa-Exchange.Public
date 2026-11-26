/**
 * Provider-neutral QUBO optimization contract with a local classical
 * simulated-annealing backend. This is quantum-inspired, not a QPU execution
 * claim. Keep the interface stable so a future managed QPU adapter can be
 * introduced without changing supply-chain domain code.
 */

export interface QuadraticTerm {
  i: number;
  j: number;
  coefficient: number;
}
export interface QuboProblem {
  /** Binary variable objective: offset + sum(linear[i] * x[i]) + sum(Qij * xi * xj). */
  linear: number[];
  quadratic?: QuadraticTerm[];
  offset?: number;
}
export interface OptimizationOptions {
  iterations?: number;
  initialTemperature?: number;
  finalTemperature?: number;
  seed?: number;
}
export interface OptimizationResult {
  backend: "classical-simulated-annealing";
  variables: number[];
  energy: number;
  iterations: number;
  seed: number;
  optimalityGuaranteed: false;
}
export interface OptimizationBackend {
  readonly name: string;
  solve(problem: QuboProblem, options?: OptimizationOptions): OptimizationResult;
}

function validate(problem: QuboProblem): void {
  if (!Array.isArray(problem.linear) || problem.linear.length === 0) {
    throw new Error("QUBO requires at least one linear coefficient");
  }
  if (!problem.linear.every(Number.isFinite)) throw new Error("QUBO linear coefficients must be finite");
  if (problem.offset !== undefined && !Number.isFinite(problem.offset)) {
    throw new Error("QUBO offset must be finite");
  }
  const seen = new Set<string>();
  for (const term of problem.quadratic ?? []) {
    if (!Number.isInteger(term.i) || !Number.isInteger(term.j) ||
        term.i < 0 || term.j < 0 || term.i >= problem.linear.length ||
        term.j >= problem.linear.length || term.i === term.j) {
      throw new Error("QUBO quadratic indices must reference two distinct variables");
    }
    if (!Number.isFinite(term.coefficient)) throw new Error("QUBO quadratic coefficients must be finite");
    const key = term.i < term.j ? `${term.i}:${term.j}` : `${term.j}:${term.i}`;
    if (seen.has(key)) throw new Error("QUBO quadratic variable pairs must be unique");
    seen.add(key);
  }
}

function energy(problem: QuboProblem, bits: number[]): number {
  let value = problem.offset ?? 0;
  for (let i = 0; i < bits.length; i += 1) value += problem.linear[i] * bits[i];
  for (const term of problem.quadratic ?? []) {
    value += term.coefficient * bits[term.i] * bits[term.j];
  }
  return value;
}

function randomGenerator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

export class SimulatedAnnealingBackend implements OptimizationBackend {
  readonly name = "classical-simulated-annealing" as const;

  solve(problem: QuboProblem, options: OptimizationOptions = {}): OptimizationResult {
    validate(problem);
    const iterations = Math.max(1, Math.min(Math.floor(options.iterations ?? 20_000), 2_000_000));
    const initialTemperature = options.initialTemperature ?? 10;
    const finalTemperature = options.finalTemperature ?? 0.01;
    const seed = options.seed ?? 42;
    if (!Number.isFinite(initialTemperature) || !Number.isFinite(finalTemperature) ||
        initialTemperature <= 0 || finalTemperature <= 0 || finalTemperature > initialTemperature) {
      throw new Error("Annealing temperatures must be finite, positive and final <= initial");
    }
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
      throw new Error("Seed must be an unsigned 32-bit integer");
    }

    const random = randomGenerator(seed);
    const current = Array.from({ length: problem.linear.length }, () => random() < 0.5 ? 0 : 1);
    let currentEnergy = energy(problem, current);
    let best = current.slice();
    let bestEnergy = currentEnergy;

    for (let step = 0; step < iterations; step += 1) {
      const fraction = iterations === 1 ? 1 : step / (iterations - 1);
      const temperature = initialTemperature *
        Math.pow(finalTemperature / initialTemperature, fraction);
      const index = Math.floor(random() * current.length);
      current[index] = 1 - current[index];
      const candidateEnergy = energy(problem, current);
      const delta = candidateEnergy - currentEnergy;
      if (delta <= 0 || random() < Math.exp(-delta / temperature)) {
        currentEnergy = candidateEnergy;
        if (currentEnergy < bestEnergy) {
          bestEnergy = currentEnergy;
          best = current.slice();
        }
      } else {
        current[index] = 1 - current[index];
      }
    }

    return {
      backend: this.name,
      variables: best,
      energy: bestEnergy,
      iterations,
      seed,
      optimalityGuaranteed: false,
    };
  }
}

export function solveQubo(
  problem: QuboProblem,
  options?: OptimizationOptions,
  backend: OptimizationBackend = new SimulatedAnnealingBackend(),
): OptimizationResult {
  return backend.solve(problem, options);
}
