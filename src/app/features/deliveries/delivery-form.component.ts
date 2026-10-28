import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, FormControl, FormRecord, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error.model';
import { Delivery, DeliveryLineRequest } from '../../core/models/delivery.model';
import { InvoiceLine } from '../../core/models/invoice.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { formatNumber } from '../articles/article-format';
import { DeliveriesService } from './deliveries.service';

/**
 * One delivery note: how much of each line leaves the shop today. Every line that still owes
 * something is offered, filled with all of it — handing everything over is the common case.
 */
@Component({
  selector: 'app-delivery-form',
  imports: [ReactiveFormsModule, FieldErrorComponent],
  templateUrl: './delivery-form.component.html',
  styleUrl: './delivery-form.component.css',
})
export class DeliveryFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(DeliveriesService);

  invoiceId = input.required<string>();
  invoiceNumber = input('');
  /** The lines of the invoice, delivered ones included: the form sorts out what is left. */
  lines = input.required<InvoiceLine[]>();

  delivered = output<Delivery>();
  cancelled = output<void>();

  saving = signal(false);
  formError = signal<string | null>(null);

  /** Only what still owes something: a line handed over in full has nothing more to give. */
  pending = computed(() => this.lines().filter(line => line.remainingToDeliver > 0));

  // Same rules as DeliveryCreateRequest on the backend.
  form = this.fb.nonNullable.group({
    comment: ['', [Validators.maxLength(500)]],
  });

  /** One quantity per pending line, keyed by the id of the invoice line. */
  quantities = new FormRecord<FormControl<number>>({});

  protected formatNumber = formatNumber;

  ngOnInit(): void {
    for (const line of this.pending()) {
      this.quantities.addControl(
        line.id,
        new FormControl(line.remainingToDeliver, {
          nonNullable: true,
          validators: [Validators.required, Validators.min(0), Validators.max(line.remainingToDeliver)],
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

    const lines: DeliveryLineRequest[] = [];
    for (const line of this.pending()) {
      const quantity = this.quantities.controls[line.id].value;
      if (quantity > 0) lines.push({ invoiceLineId: line.id, quantity });
    }

    if (lines.length === 0) {
      this.formError.set('Indiquez au moins une quantité à livrer.');
      return;
    }

    this.saving.set(true);
    this.formError.set(null);

    const comment = this.form.getRawValue().comment.trim();

    this.service.create(this.invoiceId(), { comment: comment || null, lines }).subscribe({
      next: delivery => {
        this.saving.set(false);
        this.delivered.emit(delivery);
      },
      error: (error: ApiError) => {
        this.saving.set(false);
        this.formError.set(error.message);
      },
    });
  }
}
