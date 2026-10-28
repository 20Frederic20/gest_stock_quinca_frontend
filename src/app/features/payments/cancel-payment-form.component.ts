import { Component, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error.model';
import { Payment } from '../../core/models/payment.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { PaymentsService } from './payments.service';

/** The backend refuses a blank reason (@NotBlank): spaces only must not pass the front either. */
function notBlank(control: AbstractControl): ValidationErrors | null {
  const value = control.value as string;
  return value && !value.trim() ? { blank: true } : null;
}

/** Cancels a payment. It stays on file, and its amount goes back to what the invoice owes. */
@Component({
  selector: 'app-cancel-payment-form',
  imports: [ReactiveFormsModule, FieldErrorComponent],
  templateUrl: './cancel-payment-form.component.html',
  styleUrl: './cancel-payment-form.component.css',
})
export class CancelPaymentFormComponent {
  private fb = inject(FormBuilder);
  private service = inject(PaymentsService);

  paymentId = input.required<string>();
  /** e.g. "REG-COT-2026-00042 — 50 000 F CFA". */
  summary = input('');

  saved = output<Payment>();
  cancelled = output<void>();

  saving = signal(false);
  formError = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});

  // Same rules as CancelPaymentRequest on the backend.
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

    this.service.cancel(this.paymentId(), this.form.getRawValue().reason.trim()).subscribe({
      next: payment => {
        this.saving.set(false);
        this.saved.emit(payment);
      },
      error: (error: ApiError) => {
        this.saving.set(false);
        this.formError.set(error.message);
        this.fieldErrors.set(error.fieldErrors);
      },
    });
  }
}
