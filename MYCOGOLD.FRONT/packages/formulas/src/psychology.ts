import { clamp } from "./mathematics";

export type TrustSignals = {
  completedTrades: number;
  fulfilledTrades: number;
  disputes: number;
};

export function trustScore(signals: TrustSignals): number {
  if (Object.values(signals).some((value) => !Number.isFinite(value) || value < 0) || signals.fulfilledTrades > signals.completedTrades || signals.disputes > signals.completedTrades) {
    throw new Error("Trust signals must be non-negative and internally consistent.");
  }
  if (signals.completedTrades === 0) return 0;
  return clamp(((signals.fulfilledTrades - signals.disputes) / signals.completedTrades) * 100, 0, 100);
}

export function confidenceLabel(score: number): "low" | "medium" | "high" {
  if (!Number.isFinite(score) || score < 0 || score > 1) throw new Error("Confidence must be between 0 and 1.");
  if (score < 0.5) return "low";
  if (score < 0.8) return "medium";
  return "high";
}
