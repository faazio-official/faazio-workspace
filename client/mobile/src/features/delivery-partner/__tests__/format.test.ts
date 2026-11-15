import { formatRupees, formatNumber, formatOnlineTime } from '../format';

describe('delivery money/number formatting', () => {
  it('renders whole rupees for headline figures (paisa → ₹, Indian grouping)', () => {
    expect(formatRupees(0)).toBe('₹0');
    expect(formatRupees(123400)).toBe('₹1,234');
    expect(formatRupees(1500000)).toBe('₹15,000');
  });

  it('renders paise only when the caller asks for two decimals', () => {
    expect(formatRupees(123450, 2)).toBe('₹1,234.50');
    expect(formatRupees(100, 2)).toBe('₹1.00');
  });

  it('guards non-finite money so a bad value never prints NaN', () => {
    expect(formatRupees(Number.NaN)).toBe('₹0');
    expect(formatRupees(Number.POSITIVE_INFINITY)).toBe('₹0');
  });

  it('formats counts and distances with a controlled precision', () => {
    expect(formatNumber(12345)).toBe('12,345');
    expect(formatNumber(4.8, 1)).toBe('4.8');
    expect(formatNumber(3.25, 1)).toBe('3.3');
    expect(formatNumber(Number.NaN)).toBe('0');
  });

  it('formats worked time as h/m and floors bad input to 0m', () => {
    expect(formatOnlineTime(0)).toBe('0m');
    expect(formatOnlineTime(1800)).toBe('30m');
    expect(formatOnlineTime(3600)).toBe('1h 0m');
    expect(formatOnlineTime(12240)).toBe('3h 24m');
    expect(formatOnlineTime(Number.NaN)).toBe('0m');
    expect(formatOnlineTime(-60)).toBe('0m');
  });
});
