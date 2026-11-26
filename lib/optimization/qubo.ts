/**
 * Provider-neutral QUBO optimization contract with a local classical
 * simulated-annealing backend. This is quantum-inspired, not a QPU execution
 * claim. Keep the interface stable so a future managed QPU adapter can be
 * introduced without changing supply-chain domain code.
 */

export interface QuadraticTerm {
  i: number
  j: number
  coefficient: number
}

export interface QuboProblem {
  /** Binary variable objective: offset + sum(linear[i] * x[i]) + sum(Qij * xi * xj). */
  linear: number[]
  quadratic?: QuadraticTerm[]
  offset?: number
}

export interface OptimizationOptions {
  iterations?: number
  initialTemperature?: number
  finalTemperature?: number
  seed?: number
}

export interface OptimizationResult {
  backend: "classical-simulated-annealing"
  variables: number[]
  energy: number
  iterations: number
  seed: number
  optimalityGuaranteed: false
}

export interface OptimizationBackend {
  readonly name: string
  solve(problem: QuboProblem, options?: OptimizationOptions): OptimizationResult
}

type Neighbor = { index: number; coefficient: number }

function validate(problem: QuboProblem): void {
  if (!Array.isArray(problem.linear) || problem.linear.length === 0) {
    throw new Error("QUBO requires at least one linear coefficient")
  }
  if (!problem.linear.every(Number.isFinite)) {
    throw new Error("QUBO linear coefficients must be finite")
  }
  if (problem.offset !== undefined && !Number.isFinite(problem.offset)) {
    throw new Error("QUBO offset must be finite")
  }
  if (problem.quadratic !== undefined && !Array.isArray(problem.quadratic)) {
    throw new Error("QUBO quadratic terms must be an array")
  }

  const seen = new Set<string>()
  for (const term of problem.quadratic ?? []) {
    if (!Number.isInteger(term.i) || !Number.isInteger(term.j) ||
        term.i < 0 || term.j < 0 || term.i >= problem.linear.length ||
        term.j >= problem.linear.length || term.i === term.j) {
      throw new Error("QUBO quadratic indices must reference two distinct variables")
    }
    if (!Number.isFinite(term.coefficient)) {
      throw new Error("QUBO quadratic coefficients must be finite")
    }
    const key = term.i < term.j ? `${term.i}:${term.j}` : `${term.j}:${term.i}`
    if (seen.has(key)) throw new Error("QUBO quadratic variable pairs must be unique")
    seen.add(key)
  }
}

function energy(problem: QuboProblem, bits: readonly number[]): number {
  let value = problem.offset ?? 0
  for (let i = 0; i < bits.length; i += 1) {
    value += problem.linear[i] * bits[i]
  }
  for (const term of problem.quadratic ?? []) {
    value += term.coefficient * bits[term.i] * bits[term.j]
  }
  if (!Number.isFinite(value)) throw new Error("QUBO energy exceeds the supported numeric range")
  return value
}

function buildAdjacency(problem: QuboProblem): Neighbor[][] {
  const adjacency = Array.from({ length: problem.linear.length }, () => [] as Neighbor[])
  for (const term of problem.quadratic ?? []) {
    adjacency[term.i].push({ index: term.j, coefficient: term.coefficient })
    adjacency[term.j].push({ index: term.i, coefficient: term.coefficient })
  }
  return adjacency
}

function randomGenerator(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
}

export class SimulatedAnnealingBackend implements OptimizationBackend {
  readonly name = "classical-simulated-annealing" as const

  solve(problem: QuboProblem, options: OptimizationOptions = {}): OptimizationResult {
    validate(problem)

    const requestedIterations = options.iterations ?? 20_000
    if (!Number.isSafeInteger(requestedIterations) || requestedIterations < 1) {
      throw new Error("Iterations must be a positive safe integer")
    }
    const iterations = Math.min(requestedIterations, 2_000_000)
    const initialTemperature = options.initialTemperature ?? 10
    const finalTemperature = options.finalTemperature ?? 0.01
    const seed = options.seed ?? 42

    if (!Number.isFinite(initialTemperature) || !Number.isFinite(finalTemperature) ||
        initialTemperature <= 0 || finalTemperature <= 0 || finalTemperature > initialTemperature) {
      throw new Error("Annealing temperatures must be finite, positive and final <= initial")
    }
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
      throw new Error("Seed must be an unsigned 32-bit integer")
    }

    const random = randomGenerator(seed)
    const adjacency = buildAdjacency(problem)
    const current = Array.from(
      { length: problem.linear.length },
      () => random() < 0.5 ? 0 : 1,
    )
    let currentEnergy = energy(problem, current)
    let best = current.slice()
    let bestEnergy = currentEnergy

    const logInitial = Math.log(initialTemperature)
    const logFinal = Math.log(finalTemperature)

    for (let step = 0; step < iterations; step += 1) {
      const fraction = iterations === 1 ? 1 : step / (iterations - 1)
      const temperature = Math.exp(logInitial + (logFinal - logInitial) * fraction)
      const index = Math.floor(random() * current.length)
      const change = current[index] === 0 ? 1 : -1

      // Flipping one binary variable changes only its linear term and adjacent
      // quadratic terms: O(degree(index)) instead of rescanning the whole QUBO.
      let delta = problem.linear[index] * change
      for (const neighbor of adjacency[index]) {
        delta += neighbor.coefficient * change * current[neighbor.index]
      }
      if (!Number.isFinite(delta)) {
        throw new Error("QUBO flip delta exceeds the supported numeric range")
      }

      const candidateEnergy = currentEnergy + delta
      if (!Number.isFinite(candidateEnergy)) {
        throw new Error("Candidate QUBO energy exceeds the supported numeric range")
      }

      if (delta <= 0 || random() < Math.exp(-delta / temperature)) {
        current[index] = 1 - current[index]
        currentEnergy = candidateEnergy
        if (currentEnergy < bestEnergy) {
          bestEnergy = currentEnergy
          best = current.slice()
        }
      }

      // Periodically remove floating-point accumulation drift without paying
      // the full O(number of terms) energy cost on every proposed bit flip.
      if ((step + 1) % 4_096 === 0) {
        currentEnergy = energy(problem, current)
      }
    }

    return {
      backend: this.name,
      variables: best,
      energy: bestEnergy,
      iterations,
      seed,
      optimalityGuaranteed: false,
    }
  }
}

export function solveQubo(
  problem: QuboProblem,
  options?: OptimizationOptions,
  backend: OptimizationBackend = new SimulatedAnnealingBackend(),
): OptimizationResult {
  return backend.solve(problem, options)
}
