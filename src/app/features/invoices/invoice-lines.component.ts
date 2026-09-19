import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error.model';
import { Invoice, InvoiceLine } from '../../core/models/invoice.model';
import { formatNumber, rateToPercent } from '../articles/article-format';
import { formatMoney } from '../pricing/price-rules';
import { InvoicesService } from './invoices.service';

/**
 * Lines of a document. On a draft, quantity and discount are edited in place and a line can be removed:
 * each change is saved at once and answered with the whole document, handed to the page.
 */
@Component({
  selector: 'app-invoice-lines',
  imports: [ReactiveFormsModule],
  templateUrl: './invoice-lines.component.html',
  styleUrl: './invoice-lines.component.css',
})
export class InvoiceLinesComponent {
  private fb = inject(FormBuilder);
  private service = inject(InvoicesService);

  invoiceId = input.required<string>();
  lines = input.required<InvoiceLine[]>();
  editable = input(false);

  changed = output<Invoice>();
  failed = output<string>();

  /** The line being edited, one at a time. */
  editingId = signal<string | null>(null);
  busy = signal(false);

  // Same rules as InvoiceLineRequest on the backend.
  form = this.fb.nonNullable.group({
    quantity: [1, [Validators.required, Validators.min(0.0001)]],
    discountRate: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    // Kept at the line's current price unless the seller changes it: the backend refuses
    // anything below the packaging's own price, whichever grid it comes from.
    unitPrice: [0, [Validators.required, Validators.min(0)]],
  });

  protected formatMoney = formatMoney;
  protected formatNumber = formatNumber;
  protected rateToPercent = rateToPercent;

  edit(line: InvoiceLine): void {
    this.editingId.set(line.id);
    this.form.reset({ quantity: line.quantity, discountRate: line.discountRate, unitPrice: line.unitPrice });
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  save(line: InvoiceLine): void {
    if (this.form.invalid) {
      this.failed.emit('La quantité doit être positive et la remise comprise entre 0 et 100 %.');
      return;
    }

    this.busy.set(true);
    const body = { packagingId: line.packagingId, ...this.form.getRawValue() };

    this.service.updateLine(this.invoiceId(), line.id, body).subscribe({
      next: invoice => {
        this.busy.set(false);
        this.editingId.set(null);
        this.changed.emit(invoice);
      },
      error: (error: ApiError) => {
        this.busy.set(false);
        this.failed.emit(error.message);
      },
    });
  }

  /** No confirmation: the document is still a draft, the line is added back in a few seconds. */
  remove(line: InvoiceLine): void {
    this.busy.set(true);

    this.service.removeLine(this.invoiceId(), line.id).subscribe({
      next: invoice => {
        this.busy.set(false);
        if (this.editingId() === line.id) this.editingId.set(null);
        this.changed.emit(invoice);
      },
      error: (error: ApiError) => {
        this.busy.set(false);
        this.failed.emit(error.message);
      },
    });
  }
}
