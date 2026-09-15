import { Component, input, output } from '@angular/core';
import { CUSTOMER_TYPE_LABELS, Customer, CustomerCredit } from '../../core/models/customer.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { formatDate } from '../articles/article-format';
import { formatMoney } from '../pricing/price-rules';

/** 0 → "Comptant", 1 → "1 jour", 30 → "30 jours". */
export function paymentTermLabel(days: number): string {
  if (days === 0) return 'Comptant';
  return days === 1 ? '1 jour' : `${days} jours`;
}

/**
 * Read-only sheet of a customer and their credit situation, with its actions.
 * The list loads the credit and decides what each action does.
 */
@Component({
  selector: 'app-customer-detail',
  imports: [BadgeComponent],
  templateUrl: './customer-detail.component.html',
  styleUrl: './customer-detail.component.css',
})
export class CustomerDetailComponent {
  customer = input.required<Customer>();
  credit = input<CustomerCredit | null>(null);
  creditLoading = input(false);
  creditError = input<string | null>(null);
  /** Edit and activate/deactivate. */
  canEdit = input(true);
  canDelete = input(true);

  edit = output<void>();
  toggleActive = output<void>();
  delete = output<void>();

  protected typeLabels = CUSTOMER_TYPE_LABELS;
  protected formatDate = formatDate;
  protected formatMoney = formatMoney;
  protected paymentTermLabel = paymentTermLabel;
}
