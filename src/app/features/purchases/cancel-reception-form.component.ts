import { Component, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error.model';
import { Reception } from '../../core/models/reception.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { ReceptionsService } from './receptions.service';

/** The backend refuses a blank reason (@NotBlank): spaces only must not pass the front either. */
function notBlank(control: AbstractControl): ValidationErrors | null {
  const value = control.value as string;
  return value && !value.trim() ? { blank: true } : null;
}

/** Cancels a payment. It stays on file, and its amount goes back to what the invoice owes. */
@Component({
  selector: 'app-cancel-reception-form',
  imports: [ReactiveFormsModule, FieldErrorComponent],
  templateUrl: './cancel-reception-form.component.html',
  styleUrl: './cancel-reception-form.component.css',
})
export class CancelReceptionFormComponent {
  private fb = inject(FormBuilder);
  private service = inject(ReceptionsService);

  receptionId = input.required<string>();
  /** e.g. "REC-COT-2026-00042 du 16/09/2026". */
  summary = input('');

  saved = output<Reception>();
  cancelled = output<void>();

  saving = signal(false);
  formError = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});

  // Same rules as CancelReceptionRequest on the backend.
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

    this.service.cancel(this.receptionId(), this.form.getRawValue().reason.trim()).subscribe({
      next: reception => {
        this.saving.set(false);
        this.saved.emit(reception);
      },
      error: (error: ApiError) => {
        this.saving.set(false);
        this.formError.set(error.message);
        this.fieldErrors.set(error.fieldErrors);
      },
    });
  }
}
