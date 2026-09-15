import { Component, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error.model';
import { Invoice } from '../../core/models/invoice.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { InvoicesService } from './invoices.service';

/** The backend refuses a blank reason (@NotBlank): spaces only must not pass the front either. */
function notBlank(control: AbstractControl): ValidationErrors | null {
  const value = control.value as string;
  return value && !value.trim() ? { blank: true } : null;
}

/** Cancels a validated document. It stays in the records, marked as cancelled with its reason. */
@Component({
  selector: 'app-cancel-invoice-form',
  imports: [ReactiveFormsModule, FieldErrorComponent],
  templateUrl: './cancel-invoice-form.component.html',
  styleUrl: './cancel-invoice-form.component.css',
})
export class CancelInvoiceFormComponent {
  private fb = inject(FormBuilder);
  private service = inject(InvoicesService);

  invoiceId = input.required<string>();
  /** e.g. "Facture FAC-COT-2026-00042 — 59 000 F CFA". */
  summary = input('');
  saved = output<Invoice>();
  cancelled = output<void>();

  saving = signal(false);
  formError = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});

  // Same rules as CancelInvoiceRequest on the backend.
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

    this.service.cancel(this.invoiceId(), this.form.getRawValue().reason.trim()).subscribe({
      next: invoice => {
        this.saving.set(false);
        this.saved.emit(invoice);
      },
      error: (error: ApiError) => {
        this.saving.set(false);
        this.formError.set(error.message);
        this.fieldErrors.set(error.fieldErrors);
      },
    });
  }
}
