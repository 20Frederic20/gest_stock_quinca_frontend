import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, FormControl, FormRecord, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error.model';
import { PurchaseOrderLine } from '../../core/models/purchase-order.model';
import { Reception, ReceptionLineRequest } from '../../core/models/reception.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { formatNumber } from '../articles/article-format';
import { ReceptionsService } from './receptions.service';

/**
 * Receives goods against an order: how much of each line actually arrived. The backend writes the
 * reception as a draft and only moves the stock on confirmation, so both follow one another here —
 * a receiving clerk does one thing, not two.
 */
@Component({
  selector: 'app-reception-form',
  imports: [ReactiveFormsModule, FieldErrorComponent],
  templateUrl: './reception-form.component.html',
  styleUrl: './reception-form.component.css',
})
export class ReceptionFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(ReceptionsService);

  orderId = input.required<string>();
  orderNumber = input('');
  /** The lines of the order, received ones included: the form sorts out what is left. */
  lines = input.required<PurchaseOrderLine[]>();

  /** The reception, written and confirmed: the stock has moved. */
  received = output<Reception>();
  /** Written but left in draft: the section reloads so it does not get lost. */
  failed = output<Reception>();
  cancelled = output<void>();

  saving = signal(false);
  formError = signal<string | null>(null);

  /** Only what is still awaited: a line received in full has nothing more to bring. */
  pending = computed(() => this.lines().filter(line => line.remainingToReceive > 0));

  // Same rules as ReceptionCreateRequest on the backend.
  form = this.fb.nonNullable.group({
    comment: ['', [Validators.maxLength(500)]],
  });

  /** One quantity per pending line, keyed by the id of the order line. */
  quantities = new FormRecord<FormControl<number>>({});

  protected formatNumber = formatNumber;

  ngOnInit(): void {
    for (const line of this.pending()) {
      this.quantities.addControl(
        line.id,
        new FormControl(line.remainingToReceive, {
          nonNullable: true,
          validators: [Validators.required, Validators.min(0), Validators.max(line.remainingToReceive)],
        }),
      );
    }
  }

  submit(): void {
    if (this.quantities.invalid || this.form.invalid) {
      this.quantities.markAllAsTouched();
      this.form.markAllAsTouched();
      return;
    }

    const lines: ReceptionLineRequest[] = [];
    for (const line of this.pending()) {
      const quantity = this.quantities.controls[line.id].value;
      if (quantity > 0) lines.push({ purchaseOrderLineId: line.id, quantity });
    }

    if (lines.length === 0) {
      this.formError.set('Indiquez au moins une quantité reçue.');
      return;
    }

    this.saving.set(true);
    this.formError.set(null);

    const comment = this.form.getRawValue().comment.trim();

    this.service.create(this.orderId(), { comment: comment || null, lines }).subscribe({
      next: reception => this.confirm(reception),
      error: (error: ApiError) => {
        this.saving.set(false);
        this.formError.set(error.message);
      },
    });
  }

  /** The draft exists on the backend: whatever happens now, it must not be lost from sight. */
  private confirm(reception: Reception): void {
    this.service.confirm(reception.id).subscribe({
      next: confirmed => {
        this.saving.set(false);
        this.received.emit(confirmed);
      },
      error: (error: ApiError) => {
        this.saving.set(false);
        this.formError.set(
          `La réception ${reception.number} a été créée mais n’a pas pu être confirmée : ${error.message}`,
        );
        this.failed.emit(reception);
      },
    });
  }
}
