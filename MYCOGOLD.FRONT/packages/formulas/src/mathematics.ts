export function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(minimum) || !Number.isFinite(maximum)) {
    throw new Error("Bounds and value must be finite numbers.");
  }
  if (minimum > maximum) throw new Error("Minimum cannot exceed maximum.");
  return Math.min(Math.max(value, minimum), maximum);
}

export function percentageChange(previous: number, current: number): number {
  if (!Number.isFinite(previous) || !Number.isFinite(current) || previous <= 0) {
    throw new Error("Previous value must be a positive finite number.");
  }
  return (current - previous) / previous;
}

export function weightedMean(values: readonly number[], weights: readonly number[]): number {
  if (values.length === 0 || values.length !== weights.length) {
    throw new Error("Values and weights must be non-empty and have equal lengths.");
  }
  if (values.some((value) => !Number.isFinite(value)) || weights.some((weight) => !Number.isFinite(weight) || weight < 0)) {
    throw new Error("Values must be finite and weights must be non-negative.");
  }
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight <= 0) throw new Error("At least one weight must be positive.");
  return values.reduce((sum, value, index) => sum + value * weights[index], 0) / totalWeight;
}
