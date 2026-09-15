export type TransportEstimate = {
  distanceKm: number;
  fuelLitresPerKm: number;
  fuelPrice: number;
  loadKg: number;
};

export function estimateTransportCost(input: TransportEstimate): number {
  if (Object.values(input).some((value) => !Number.isFinite(value)) || input.distanceKm < 0 || input.fuelLitresPerKm < 0 || input.fuelPrice < 0 || input.loadKg <= 0) {
    throw new Error("Transport values must be finite, non-negative, and include a positive load.");
  }
  return input.distanceKm * input.fuelLitresPerKm * input.fuelPrice;
}

export function estimateTravelHours(distanceKm: number, averageSpeedKmh: number): number {
  if (!Number.isFinite(distanceKm) || !Number.isFinite(averageSpeedKmh) || distanceKm < 0 || averageSpeedKmh <= 0) {
    throw new Error("Distance must be non-negative and speed must be positive.");
  }
  return distanceKm / averageSpeedKmh;
}
