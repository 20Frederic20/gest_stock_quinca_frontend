import { formatDate, formatNumber, percentToRate, rateToPercent } from './article-format';

describe('rateToPercent', () => {
  it('turns the stored fraction into a percentage', () => {
    expect(rateToPercent(0.18)).toBe(18);
    expect(rateToPercent(0)).toBe(0);
  });

  it('hides floating-point noise', () => {
    // 0.07 * 100 === 7.000000000000001 in JavaScript.
    expect(rateToPercent(0.07)).toBe(7);
    expect(rateToPercent(0.185)).toBe(18.5);
  });
});

describe('percentToRate', () => {
  it('turns the typed percentage into the fraction the API stores', () => {
    expect(percentToRate(18)).toBe(0.18);
    expect(percentToRate(7)).toBe(0.07);
    expect(percentToRate(18.5)).toBe(0.185);
    expect(percentToRate(100)).toBe(1);
  });
});

describe('formatDate', () => {
  it('shows a backend date as dd/mm/yyyy', () => {
    expect(formatDate('2026-09-13T11:32:32.423855')).toBe('13/09/2026');
  });

  it('shows a dash when there is no date', () => {
    expect(formatDate('')).toBe('—');
    expect(formatDate(null)).toBe('—');
  });
});

describe('formatNumber', () => {
  it('uses the French decimal comma and drops useless zeros', () => {
    // French groups thousands with a narrow no-break space.
    expect(formatNumber(2000)).toBe('2 000');
    expect(formatNumber(12.5)).toBe('12,5');
  });
});
