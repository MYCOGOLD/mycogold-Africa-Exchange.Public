import { describe, it, expect } from 'vitest';
import { weightedPriceKes, mfpiFromWeightedPrice, mfpiFromConfirmedTrades, BASE_MFPI } from './mfpi';
describe('mfpi', () => {
  it('weighted price: known answer', () => {
    // (100*10 + 50*10) / 20 = 75
    expect(weightedPriceKes([{ price_KES: 100, kg: 10 }, { price_KES: 50, kg: 10 }])).toBeCloseTo(75, 6);
  });
  it('mfpi at base price = base mfpi', () => {
    expect(mfpiFromWeightedPrice(52)).toBeCloseTo(BASE_MFPI, 6);
  });
  it('mfpi formula: 104 -> 99.06654 + 100 = 199.06654', () => {
    expect(mfpiFromWeightedPrice(104)).toBeCloseTo(199.06654, 5);
  });
  it('empty / zero / invalid -> null, no silent coercion', () => {
    expect(weightedPriceKes([])).toBeNull();
    expect(weightedPriceKes([{ price_KES: 100, kg: 0 }])).toBeNull();
    expect(weightedPriceKes([{ price_KES: NaN, kg: 10 } as any])).toBeNull();
    expect(mfpiFromConfirmedTrades([])).toBeNull();
  });
});
