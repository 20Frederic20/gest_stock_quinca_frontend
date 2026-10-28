import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error.model';
import { DayClosing } from '../../core/models/day-closing.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { DayClosingService } from './day-closing.service';

/** Opens the till of an agency: the cashier declares the cash float they start with. */
@Component({
  selector: 'app-day-closing-open-form',
  imports: [ReactiveFormsModule, FieldErrorComponent],
  templateUrl: './day-closing-open-form.component.html',
  styleUrl: './day-closing-open-form.component.css',
})
export class DayClosingOpenFormComponent {
  private fb = inject(FormBuilder);
  private service = inject(DayClosingService);

  agencyId = input.required<string>();

  opened = output<DayClosing>();
  cancelled = output<void>();

  saving = signal(false);
  formError = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});

  // Same rules as DayClosingOpenRequest on the backend.
  form = this.fb.nonNullable.group({
    openingCashAmount: [0, [Validators.required, Validators.min(0)]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set(null);
    this.fieldErrors.set({});

    this.service.open(this.agencyId(), this.form.getRawValue()).subscribe({
      next: dayClosing => {
        this.saving.set(false);
        this.opened.emit(dayClosing);
      },
      error: (error: ApiError) => {
        this.saving.set(false);
        this.formError.set(error.message);
        this.fieldErrors.set(error.fieldErrors);
      },
    });
  }
}
