/*
 * The API stores the VAT rate as a fraction (0.18) while users think in percent (18).
 * The conversion happens only here, at the edge of the screen.
 */

/** 0.18 → 18. Rounded to 2 decimals, the precision of the database column. */
export function rateToPercent(rate: number): number {
  return Math.round(rate * 10000) / 100;
}

/** 18 → 0.18. */
export function percentToRate(percent: number): number {
  return Math.round(percent * 100) / 10000;
}

const numberFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 });

/** 2000 → "2 000", 12.5 → "12,5". */
export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/**
 * "2026-09-13T11:32:32.423855" → "13/09/2026".
 * Read from the text rather than through Date, which would shift the day with the time zone.
 */
export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}
