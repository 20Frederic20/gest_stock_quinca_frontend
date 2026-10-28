import { Component, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error.model';
import { StockMovement } from '../../core/models/stock.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { StockService } from '../stock/stock.service';

/** The backend refuses a blank reason (@NotBlank): spaces only must not pass the front either. */
function notBlank(control: AbstractControl): ValidationErrors | null {
  const value = control.value as string;
  return value && !value.trim() ? { blank: true } : null;
}

/** Cancels a movement by recording the opposite one. The original stays in the history. */
@Component({
  selector: 'app-reversal-form',
  imports: [ReactiveFormsModule, FieldErrorComponent],
  templateUrl: './reversal-form.component.html',
  styleUrl: './reversal-form.component.css',
})
export class ReversalFormComponent {
  private fb = inject(FormBuilder);
  private service = inject(StockService);

  movementId = input.required<string>();
  /** e.g. "Inventaire du 15/09/2026 08:27 : +8 400 (Ciment CIM II 32.5R)". */
  summary = input('');
  saved = output<StockMovement>();
  cancelled = output<void>();

  saving = signal(false);
  formError = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});

  // Same rules as ReversalRequest on the backend.
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

    this.service.reverse(this.movementId(), { reason: this.form.getRawValue().reason.trim() }).subscribe({
      next: movement => {
        this.saving.set(false);
        this.saved.emit(movement);
      },
      error: (error: ApiError) => {
        this.saving.set(false);
        this.formError.set(error.message);
        this.fieldErrors.set(error.fieldErrors);
      },
    });
  }
}
