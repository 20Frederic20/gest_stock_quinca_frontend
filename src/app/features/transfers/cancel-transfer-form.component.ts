import { Component, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error.model';
import { Transfer } from '../../core/models/transfer.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { TransfersService } from './transfers.service';

/** The backend refuses a blank reason (@NotBlank): spaces only must not pass the front either. */
function notBlank(control: AbstractControl): ValidationErrors | null {
  const value = control.value as string;
  return value && !value.trim() ? { blank: true } : null;
}

/** Cancels a transfer. Whatever it already moved — the shipment, and the reception if it happened — is reversed. */
@Component({
  selector: 'app-cancel-transfer-form',
  imports: [ReactiveFormsModule, FieldErrorComponent],
  templateUrl: './cancel-transfer-form.component.html',
  styleUrl: './cancel-transfer-form.component.css',
})
export class CancelTransferFormComponent {
  private fb = inject(FormBuilder);
  private service = inject(TransfersService);

  transferId = input.required<string>();
  /** e.g. "BT-COT-2026-00042 — Cotonou → Porto-Novo". */
  summary = input('');

  saved = output<Transfer>();
  cancelled = output<void>();

  saving = signal(false);
  formError = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});

  // Same rules as CancelTransferRequest on the backend.
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

    this.service.cancel(this.transferId(), this.form.getRawValue().reason.trim()).subscribe({
      next: transfer => {
        this.saving.set(false);
        this.saved.emit(transfer);
      },
      error: (error: ApiError) => {
        this.saving.set(false);
        this.formError.set(error.message);
        this.fieldErrors.set(error.fieldErrors);
      },
    });
  }
}
