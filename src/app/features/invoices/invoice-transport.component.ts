import { Component, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error.model';
import { Invoice } from '../../core/models/invoice.model';
import { formatMoney } from '../pricing/price-rules';
import { InvoicesService } from './invoices.service';

/**
 * Transport charges, one row of the totals panel. They are typed on the draft, once the lines are known,
 * and saved at once: the backend answers with the whole document and its new total.
 */
@Component({
  selector: 'app-invoice-transport',
  imports: [ReactiveFormsModule],
  templateUrl: './invoice-transport.component.html',
  styleUrl: './invoice-transport.component.css',
})
export class InvoiceTransportComponent {
  private service = inject(InvoicesService);

  invoiceId = input.required<string>();
  /** Before VAT, as the backend holds it. */
  amount = input.required<number>();
  editable = input(false);

  changed = output<Invoice>();
  failed = output<string>();

  editing = signal(false);
  saving = signal(false);

  // Same rule as InvoiceCreateRequest.transportAmount on the backend: zero or more.
  field = new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] });

  protected formatMoney = formatMoney;

  edit(): void {
    this.field.setValue(this.amount());
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  save(): void {
    if (this.field.invalid) {
      this.field.markAsTouched();
      return;
    }

    this.saving.set(true);

    this.service.setTransport(this.invoiceId(), this.field.value).subscribe({
      next: invoice => {
        this.saving.set(false);
        this.editing.set(false);
        this.changed.emit(invoice);
      },
      // The row stays open on its amount: the seller corrects it instead of typing it again.
      error: (error: ApiError) => {
        this.saving.set(false);
        this.failed.emit(error.message);
      },
    });
  }
}
