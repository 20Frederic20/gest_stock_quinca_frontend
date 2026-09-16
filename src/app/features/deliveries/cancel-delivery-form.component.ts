import { Component, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error.model';
import { Delivery } from '../../core/models/delivery.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { DeliveriesService } from './deliveries.service';

/** The backend refuses a blank reason (@NotBlank): spaces only must not pass the front either. */
function notBlank(control: AbstractControl): ValidationErrors | null {
  const value = control.value as string;
  return value && !value.trim() ? { blank: true } : null;
}

/** Cancels a payment. It stays on file, and its amount goes back to what the invoice owes. */
@Component({
  selector: 'app-cancel-delivery-form',
  imports: [ReactiveFormsModule, FieldErrorComponent],
  templateUrl: './cancel-delivery-form.component.html',
  styleUrl: './cancel-delivery-form.component.css',
})
export class CancelDeliveryFormComponent {
  private fb = inject(FormBuilder);
  private service = inject(DeliveriesService);

  deliveryId = input.required<string>();
  /** e.g. "REG-COT-2026-00042 — 50 000 F CFA". */
  summary = input('');

  saved = output<Delivery>();
  cancelled = output<void>();

  saving = signal(false);
  formError = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});

  // Same rules as CancelDeliveryRequest on the backend.
  form = this.fb.nonNullable.group({
    reason: ['', [Validators.required, Validators.maxLength(255), notBlank]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set(null);
    this.fieldErrors.set({});

    this.service.cancel(this.deliveryId(), this.form.getRawValue().reason.trim()).subscribe({
      next: delivery => {
        this.saving.set(false);
        this.saved.emit(delivery);
      },
      error: (error: ApiError) => {
        this.saving.set(false);
        this.formError.set(error.message);
        this.fieldErrors.set(error.fieldErrors);
      },
    });
  }
}
