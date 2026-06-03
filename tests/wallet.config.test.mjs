import { describe, it } from 'node:test';
import assert from 'node:assert';

const DIAMOND_TO_RCOIN_RATE = 10;
const MIN_CONVERT_DIAMONDS = 10;
const MIN_WITHDRAW_RCOINS = 100;

describe('Wallet conversion rules', () => {
  it('converts diamonds to rcoins at 10:1 rate', () => {
    assert.strictEqual(100 / DIAMOND_TO_RCOIN_RATE, 10);
  });

  it('enforces minimum convert amount', () => {
    assert.ok(50 >= MIN_CONVERT_DIAMONDS);
    assert.ok(5 < MIN_CONVERT_DIAMONDS);
  });

  it('enforces minimum withdrawal', () => {
    assert.ok(100 >= MIN_WITHDRAW_RCOINS);
    assert.ok(50 < MIN_WITHDRAW_RCOINS);
  });
});
