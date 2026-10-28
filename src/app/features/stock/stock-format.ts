import { formatDate, formatNumber } from '../articles/article-format';

/** 2000, "KG" → "2 000 KG". */
export function formatQuantity(quantity: number, unitCode: string): string {
  return unitCode ? `${formatNumber(quantity)} ${unitCode}` : formatNumber(quantity);
}

/** +12 KG, −3 KG: the sign of a movement matters as much as its size. */
export function formatSignedQuantity(quantity: number, unitCode: string): string {
  const sign = quantity > 0 ? '+' : quantity < 0 ? '−' : '';
  return `${sign}${formatQuantity(Math.abs(quantity), unitCode)}`;
}

/** "2026-09-15T08:17:59.5" → "15/09/2026 08:17". Read from the text, like formatDate, to avoid time zone shifts. */
export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return `${formatDate(iso)} ${iso.slice(11, 16)}`;
}

/** Today as "yyyy-MM-dd", from local date parts so it matches the user's own day, not UTC's. */
export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
