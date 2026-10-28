import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error.model';
import { PurchaseOrder, PurchaseOrderLine } from '../../core/models/purchase-order.model';
import { formatNumber, rateToPercent } from '../articles/article-format';
import { formatMoney } from '../pricing/price-rules';
import { PurchaseOrdersService } from './purchase-orders.service';

/**
 * Lines of an order. On a draft, quantity and purchase price are edited in place and a line can be
 * removed: each change is saved at once and answered with the whole order, handed to the page.
 */
@Component({
  selector: 'app-purchase-order-lines',
  imports: [ReactiveFormsModule],
  templateUrl: './purchase-order-lines.component.html',
  styleUrl: './purchase-order-lines.component.css',
})
export class PurchaseOrderLinesComponent {
  private fb = inject(FormBuilder);
  private service = inject(PurchaseOrdersService);

  orderId = input.required<string>();
  lines = input.required<PurchaseOrderLine[]>();
  editable = input(false);

  changed = output<PurchaseOrder>();
  failed = output<string>();

  /** The line being edited, one at a time. */
  editingId = signal<string | null>(null);
  busy = signal(false);

  // Same rules as PurchaseOrderLineRequest on the backend.
  form = this.fb.nonNullable.group({
    quantity: [1, [Validators.required, Validators.min(0.0001)]],
    unitPrice: [0, [Validators.required, Validators.min(0)]],
  });

  protected formatMoney = formatMoney;
  protected formatNumber = formatNumber;
  protected rateToPercent = rateToPercent;

  edit(line: PurchaseOrderLine): void {
    this.form.setValue({ quantity: line.quantity, unitPrice: line.unitPrice });
    this.editingId.set(line.id);
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  save(line: PurchaseOrderLine): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    const { quantity, unitPrice } = this.form.getRawValue();

    this.service.updateLine(this.orderId(), line.id, { packagingId: line.packagingId, quantity, unitPrice }).subscribe({
      next: order => {
        this.busy.set(false);
        this.editingId.set(null);
        this.changed.emit(order);
      },
      // The row stays open on what was typed: the buyer corrects it instead of starting again.
      error: (error: ApiError) => {
        this.busy.set(false);
        this.failed.emit(error.message);
      },
    });
  }

  remove(line: PurchaseOrderLine): void {
    this.busy.set(true);

    this.service.removeLine(this.orderId(), line.id).subscribe({
      next: order => {
        this.busy.set(false);
        this.changed.emit(order);
      },
      error: (error: ApiError) => {
        this.busy.set(false);
        this.failed.emit(error.message);
      },
    });
  }
}
