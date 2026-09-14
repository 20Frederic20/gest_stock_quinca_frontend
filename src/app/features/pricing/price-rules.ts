import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { ArticlePrice } from '../../core/models/article-price.model';
import { BadgeTone } from '../../shared/badge/badge.component';

/**
 * The backend only says whether a price has started (`effective`). What the screen needs is finer:
 * - scheduled: starts later, the only kind that can still be edited or deleted;
 * - current:   the latest started price of its privilege, the one applied today;
 * - past:      started, then replaced by a newer one.
 */
export type PriceStatus = 'scheduled' | 'current' | 'past';

export const PRICE_STATUS_LABELS: Record<PriceStatus, string> = {
  scheduled: 'À venir',
  current: 'En vigueur',
  past: 'Remplacé',
};

export const PRICE_STATUS_TONES: Record<PriceStatus, BadgeTone> = {
  scheduled: 'neutral',
  current: 'accent',
  past: 'muted',
};

/** `prices` must hold the other prices of the same packaging; ISO dates compare as text. */
export function priceStatus(price: ArticlePrice, prices: ArticlePrice[], today: string): PriceStatus {
  if (price.startDate > today) return 'scheduled';

  const latestStart = prices
    .filter(p => p.privilegeId === price.privilegeId && p.startDate <= today)
    .reduce((latest, p) => (p.startDate > latest ? p.startDate : latest), '');

  return price.startDate >= latestStart ? 'current' : 'past';
}

/** "2026-09-14" for the local day. toISOString() would give the UTC day, wrong around midnight. */
export function todayIso(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  return todayIso(new Date(year, month - 1, day + days));
}

const moneyFormat = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' });

/** 5000 → "5 000 F CFA". The CFA franc has no cents. */
export function formatMoney(amount: number): string {
  return moneyFormat.format(amount);
}

/** Refuses an ISO date before `min()`, read at each check so that it can follow the edited price. */
export function minDateValidator(min: () => string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string | null;
    return value && value < min() ? { minDate: { min: min() } } : null;
  };
}
