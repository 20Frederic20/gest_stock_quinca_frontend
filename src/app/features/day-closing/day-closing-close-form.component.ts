import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error.model';
import { DayClosing } from '../../core/models/day-closing.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { formatMoney } from '../pricing/price-rules';
import { DayClosingService } from './day-closing.service';

/**
 * Closes the till: the cashier counts the drawer, the backend recomputes the theoretical
 * total on its own (see DayClosingService) and freezes the difference.
 */
@Component({
  selector: 'app-day-closing-close-form',
  imports: [ReactiveFormsModule, FieldErrorComponent],
  templateUrl: './day-closing-close-form.component.html',
  styleUrl: './day-closing-close-form.component.css',
})
export class DayClosingCloseFormComponent {
  private fb = inject(FormBuilder);
  private service = inject(DayClosingService);

  dayClosing = input.required<DayClosing>();

  closed = output<DayClosing>();
  cancelled = output<void>();

  saving = signal(false);
  formError = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});

  // Same rules as DayClosingCloseRequest on the backend.
  form = this.fb.nonNullable.group({
    countedTotal: [0, [Validators.required, Validators.min(0)]],
    comment: ['', [Validators.maxLength(500)]],
  });

  /**
   * A preview only: the amount actually frozen is whatever the backend recomputes at the
   * moment it processes the request, which may differ if a payment came in meanwhile.
   */
  previewVariance = computed(() => this.form.controls.countedTotal.value - this.dayClosing().theoreticalTotal);

  protected formatMoney = formatMoney;

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set(null);
    this.fieldErrors.set({});

    const { countedTotal, comment } = this.form.getRawValue();
    const trimmedComment = comment.trim();

    this.service.close(this.dayClosing().id, { countedTotal, comment: trimmedComment || null }).subscribe({
      next: dayClosing => {
        this.saving.set(false);
        this.closed.emit(dayClosing);
      },
      error: (error: ApiError) => {
        this.saving.set(false);
        this.formError.set(error.message);
        this.fieldErrors.set(error.fieldErrors);
      },
    });
  }
}
