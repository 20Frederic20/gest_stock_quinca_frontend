import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription, forkJoin, map, switchMap } from 'rxjs';
import { ApiError } from '../../core/http/api-error.model';
import { Agency } from '../../core/models/agency.model';
import { Customer } from '../../core/models/customer.model';
import { Invoice } from '../../core/models/invoice.model';
import { AgenciesService } from '../agencies/agencies.service';
import { formatDate, formatNumber } from '../articles/article-format';
import { CustomersService } from '../customers/customers.service';
import { formatMoney } from '../pricing/price-rules';
import { DOCUMENT_TYPE_LABELS } from './invoice-format';
import { InvoicesService } from './invoices.service';

interface PrintData {
  invoice: Invoice;
  /** Seller's details: address, phone, IFU. */
  agency: Agency;
  customer: Customer;
}

/**
 * Printable document, outside the application frame. The browser prints it or saves it as PDF:
 * no library, and the screen toolbar disappears on paper.
 */
@Component({
  selector: 'app-invoice-print',
  imports: [RouterLink],
  templateUrl: './invoice-print.component.html',
  styleUrl: './invoice-print.component.css',
})
export class InvoicePrintComponent {
  private service = inject(InvoicesService);
  private agenciesService = inject(AgenciesService);
  private customersService = inject(CustomersService);

  /** From the route, through component input binding. */
  id = input.required<string>();

  data = signal<PrintData | null>(null);
  error = signal<string | null>(null);

  protected typeLabels = DOCUMENT_TYPE_LABELS;
  protected formatDate = formatDate;
  protected formatMoney = formatMoney;
  protected formatNumber = formatNumber;

  private request?: Subscription;

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  print(): void {
    window.print();
  }

  private load(id: string): void {
    this.request?.unsubscribe();
    this.data.set(null);
    this.error.set(null);

    this.request = this.service
      .getById(id)
      .pipe(
        switchMap(invoice =>
          forkJoin({
            agency: this.agenciesService.getById(invoice.agencyId),
            customer: this.customersService.getById(invoice.customerId),
          }).pipe(map(details => ({ invoice, ...details }))),
        ),
      )
      .subscribe({
        next: data => this.data.set(data),
        error: (error: ApiError) => this.error.set(error.message),
      });
  }
}
