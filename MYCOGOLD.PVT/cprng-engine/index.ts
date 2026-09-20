import { randomInt } from 'crypto';
let MFPI = 100.00;
export function generateMFPI_Tick(realMarketChange: number = 0): number {
  const rand = randomInt(0, 1000000) / 1000000;
  const volatility = (rand - 0.5) * 0.002;
  MFPI = MFPI + (realMarketChange * 0.15) + (MFPI * volatility);
  return parseFloat(MFPI.toFixed(4));
}
