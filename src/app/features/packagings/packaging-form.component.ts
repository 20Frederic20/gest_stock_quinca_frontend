import { Component, computed, effect, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error.model';
import { Packaging } from '../../core/models/packaging.model';
import { UnitOfMeasure } from '../../core/models/unit-of-measure.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { PackagingsService } from './packagings.service';

/** Create form when `packaging` is null, edit form otherwise. Saves by itself. */
@Component({
  selector: 'app-packaging-form',
  imports: [ReactiveFormsModule, FieldErrorComponent, SelectSearchComponent],
  templateUrl: './packaging-form.component.html',
  styleUrl: './packaging-form.component.css',
})
export class PackagingFormComponent {
  private fb = inject(FormBuilder);
  private service = inject(PackagingsService);

  packaging = input<Packaging | null>(null);
  /** Article the new packaging belongs to. */
  articleId = input.required<string>();
  units = input<UnitOfMeasure[]>([]);
  /** Unit the quantity is expressed in, e.g. "KG". */
  stockUnitCode = input('');
  saved = output<void>();
  cancelled = output<void>();

  saving = signal(false);
  formError = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});

  /** Text shown in the unit select; the form only holds the id. */
  unitLabel = linkedSignal(() => {
    const packaging = this.packaging();
    return packaging ? `${packaging.unitCode} — ${packaging.unitLabel}` : '';
  });

  // Same limits as PackagingRequest on the backend: the quantity must be strictly positive.
  form = this.fb.nonNullable.group({
    unitId: ['', [Validators.required]],
    quantity: [1, [Validators.required, Validators.min(0.0001)]],
    defaultPurchase: [false],
    defaultSale: [false],
  });

  unitOptions = computed<SelectOption[]>(() =>
    this.units().map(unit => ({ id: unit.id, label: `${unit.code} — ${unit.label}` })),
  );

  constructor() {
    // Refills the form whenever another packaging is selected while the panel stays open.
    effect(() => {
      const packaging = this.packaging();
      this.formError.set(null);
      this.fieldErrors.set({});
      this.form.reset({
        unitId: packaging?.unitId ?? '',
        quantity: packaging?.quantity ?? 1,
        defaultPurchase: packaging?.defaultPurchase ?? false,
        defaultSale: packaging?.defaultSale ?? false,
      });
    });
  }

  onUnitSelected(option: SelectOption | null): void {
    this.form.controls.unitId.setValue(option?.id ?? '');
    this.form.controls.unitId.markAsTouched();
    this.unitLabel.set(option?.label ?? '');
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
    const packaging = this.packaging();
    const request = packaging
      ? this.service.update(packaging.id, body)
      : this.service.create(this.articleId(), body);

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
