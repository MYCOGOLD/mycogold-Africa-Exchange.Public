export function tuskCheck(price: number, lastPrice: number): boolean {
  return Math.abs(price - lastPrice) / lastPrice < 0.05;
}
