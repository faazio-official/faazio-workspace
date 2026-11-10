import { COIN_REDEEM_RATE } from '@data/rewards/rewards';

describe('jest harness', () => {
  it('resolves the @data alias and transforms TypeScript', () => {
    expect(typeof COIN_REDEEM_RATE).toBe('number');
  });
});
