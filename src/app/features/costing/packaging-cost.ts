import { Packaging } from '../../core/models/packaging.model';
import { formatMoney } from '../pricing/price-rules';
import { formatQuantity } from '../stock/stock-format';

/** One way of typing a purchase price: per packaging, or per stock unit itself. */
export interface CostUnitOption {
  id: string;
  /** "Sac de 50 KG", or the stock unit code for the base unit. */
  label: string;
  /** Stock units in one of it (1 for the base unit). */
  quantity: number;
}

export const BASE_COST_UNIT_ID = 'base';

/** Per-stock-unit costs may carry cents (80.5 F), which the whole-franc money format would round away. */
const unitCostFormat = new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'XOF', minimumFractionDigits: 0, maximumFractionDigits: 2,
});

const round4 = (value: number): number => Math.round(value * 10000) / 10000;

/** The article's packagings, then its stock unit. */
export function costUnitOptions(packagings: readonly Packaging[], stockUnit: string): CostUnitOption[] {
  const options: CostUnitOption[] = packagings
    .filter(p => p.quantity > 0)
    .map(p => ({ id: p.id, label: `${p.unitLabel} de ${formatQuantity(p.quantity, stockUnit)}`, quantity: p.quantity }));
  options.push({ id: BASE_COST_UNIT_ID, label: stockUnit || 'Unité de stock', quantity: 1 });
  return options;
}

/** The default purchase packaging, else the stock unit. */
export function defaultCostUnitId(packagings: readonly Packaging[]): string {
  return packagings.find(p => p.defaultPurchase && p.quantity > 0)?.id ?? BASE_COST_UNIT_ID;
}

/** Price of a packaging → cost of one stock unit, at the backend scale (4 decimals). */
export function costPerStockUnit(price: number, quantity: number): number {
  return round4(price / quantity);
}

/** Cost of one stock unit → price of a packaging. */
export function priceForPackaging(costPerUnit: number, quantity: number): number {
  return round4(costPerUnit * quantity);
}

/** "4 000 F CFA le sac de 50 KG = 80 F CFA par KG", or "80 F CFA par KG" for the base unit. */
export function conversionText(price: number, option: CostUnitOption, stockUnit: string): string {
  const perUnit = `${unitCostFormat.format(costPerStockUnit(price, option.quantity))} par ${stockUnit || 'unité de stock'}`;
  if (option.id === BASE_COST_UNIT_ID) return perUnit;
  const label = option.label.charAt(0).toLowerCase() + option.label.slice(1);
  return `${formatMoney(price)} le ${label} = ${perUnit}`;
}
