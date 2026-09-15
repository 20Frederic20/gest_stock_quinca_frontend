import { formatDateTime, formatQuantity, formatSignedQuantity } from './stock-format';

/** Intl separates thousands with narrow no-break spaces: compared with plain spaces here. */
const plain = (text: string) => text.replace(/\s/g, ' ');

describe('formatQuantity', () => {
  it('shows the quantity with its unit, in French', () => {
    expect(plain(formatQuantity(2000, 'KG'))).toBe('2 000 KG');
    expect(plain(formatQuantity(4.75, 'U'))).toBe('4,75 U');
  });

  it('shows the number alone when the unit is unknown', () => {
    expect(formatQuantity(12, '')).toBe('12');
  });
});

describe('formatSignedQuantity', () => {
  it('always shows the sign, with a real minus', () => {
    expect(plain(formatSignedQuantity(12, 'KG'))).toBe('+12 KG');
    expect(plain(formatSignedQuantity(-1500, 'KG'))).toBe('−1 500 KG');
    expect(plain(formatSignedQuantity(0, 'KG'))).toBe('0 KG');
  });
});

describe('formatDateTime', () => {
  it('shows a backend date-time as dd/mm/yyyy hh:mm, read from the text', () => {
    expect(formatDateTime('2026-09-15T08:17:59.538442842')).toBe('15/09/2026 08:17');
  });

  it('shows a dash when there is no date', () => {
    expect(formatDateTime('')).toBe('—');
  });
});
