import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error.model';
import { UnitOfMeasure } from '../../core/models/unit-of-measure.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { UnitsOfMeasureService } from './units-of-measure.service';

/** Create form when `unit` is null, edit form otherwise. Saves by itself. */
@Component({
  selector: 'app-unit-of-measure-form',
  imports: [ReactiveFormsModule, FieldErrorComponent],
  templateUrl: './unit-of-measure-form.component.html',
  styleUrl: './unit-of-measure-form.component.css',
})
export class UnitOfMeasureFormComponent {
  private fb = inject(FormBuilder);
  private service = inject(UnitsOfMeasureService);

  unit = input<UnitOfMeasure | null>(null);
  saved = output<void>();
  cancelled = output<void>();

  saving = signal(false);
  formError = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});

  // Same limits as UnitOfMeasureRequest on the backend.
  form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(20)]],
    label: ['', [Validators.required, Validators.maxLength(100)]],
  });

  constructor() {
    // Refills the form whenever another unit is selected while the panel stays open.
    effect(() => {
      const unit = this.unit();
      this.formError.set(null);
      this.fieldErrors.set({});
      this.form.reset({ code: unit?.code ?? '', label: unit?.label ?? '' });
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set(null);
    this.fieldErrors.set({});

    const body = this.form.getRawValue();
    const unit = this.unit();
    const request = unit ? this.service.update(unit.id, body) : this.service.create(body);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.emit();
      },
      error: (error: ApiError) => {
        this.saving.set(false);
        this.formError.set(error.message);
        this.fieldErrors.set(error.fieldErrors);
      },
    });
  }
}
