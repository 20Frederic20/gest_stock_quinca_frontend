import { ArticlePrice } from '../../core/models/article-price.model';
import { formatMoney, priceStatus, todayIso } from './price-rules';

const price = (id: string, privilegeId: string, startDate: string) =>
  ({ id, privilegeId, startDate }) as ArticlePrice;

describe('priceStatus', () => {
  const today = '2026-09-14';
  const retailJanuary = price('d1', 'retail', '2026-01-01');
  const retailJune = price('d2', 'retail', '2026-06-01');
  const retailDecember = price('d3', 'retail', '2026-12-01');
  const wholesaleJune = price('g1', 'wholesale', '2026-06-01');
  const all = [retailDecember, retailJune, wholesaleJune, retailJanuary];

  it('marks a price that has not started yet as scheduled', () => {
    expect(priceStatus(retailDecember, all, today)).toBe('scheduled');
  });

  it('marks the latest started price of a privilege as current', () => {
    expect(priceStatus(retailJune, all, today)).toBe('current');
    expect(priceStatus(wholesaleJune, all, today)).toBe('current');
  });

  it('marks an older started price of the same privilege as past', () => {
    expect(priceStatus(retailJanuary, all, today)).toBe('past');
  });

  it('counts a price starting today as current, like the backend', () => {
    const startingToday = price('d4', 'retail', today);

    expect(priceStatus(startingToday, [...all, startingToday], today)).toBe('current');
    expect(priceStatus(retailJune, [...all, startingToday], today)).toBe('past');
  });
});

describe('todayIso', () => {
  it('uses the local date, not the UTC one', () => {
    // 23:30 in Cotonou is already the next day in some zones, and the previous one in UTC-x.
    expect(todayIso(new Date(2026, 8, 14, 23, 30))).toBe('2026-09-14');
    expect(todayIso(new Date(2026, 0, 5, 0, 15))).toBe('2026-01-05');
  });
});

describe('formatMoney', () => {
  it('formats an amount in CFA francs, without decimals', () => {
    // Intl separates thousands with a narrow no-break space and the currency with a no-break space.
    expect(formatMoney(5000)).toBe('5 000 F CFA');
    expect(formatMoney(0)).toBe('0 F CFA');
  });
});
