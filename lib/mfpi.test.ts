import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { weightedPriceKes, mfpiFromWeightedPrice, mfpiFromConfirmedTrades, BASE_MFPI } from './mfpi';
describe('mfpi', () => {
  it('weighted price: known answer', () => {
    // (100*10 + 50*10) / 20 = 75
    assert.ok(Math.abs(weightedPriceKes([{ price_KES: 100, kg: 10 }, { price_KES: 50, kg: 10 }])! - 75) < 1e-6);
  });
  it('mfpi at base price = base mfpi', () => {
    assert.ok(Math.abs(mfpiFromWeightedPrice(52)! - BASE_MFPI) < 1e-6);
  });
  it('mfpi formula: 104 -> 99.06654 + 100 = 199.06654', () => {
    assert.ok(Math.abs(mfpiFromWeightedPrice(104)! - 199.06654) < 1e-5);
  });
  it('empty / zero / invalid -> null, no silent coercion', () => {
    assert.equal(weightedPriceKes([]), null);
    assert.equal(weightedPriceKes([{ price_KES: 100, kg: 0 }]), null);
    assert.equal(weightedPriceKes([{ price_KES: NaN, kg: 10 }]), null);
    assert.equal(mfpiFromConfirmedTrades([]), null);
  });
});
