export * from "./mathematics";
export * from "./physics";
export * from "./psychology";

export type CompletedTrade = {
  price: number;
  volume: number;
};

export function weightedAveragePrice(trades: readonly CompletedTrade[]): number {
  if (trades.length === 0) {
    throw new Error("At least one completed trade is required.");
  }

  const totalVolume = trades.reduce((sum, trade) => sum + trade.volume, 0);
  if (totalVolume <= 0 || trades.some((trade) => trade.price < 0 || trade.volume <= 0)) {
    throw new Error("Trades must have non-negative prices and positive volumes.");
  }

  return trades.reduce((sum, trade) => sum + trade.price * trade.volume, 0) / totalVolume;
}
