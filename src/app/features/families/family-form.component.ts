import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error.model';
import { Family } from '../../core/models/family.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { FamiliesService } from './families.service';
import { buildFamilyTree, descendantIds } from './family-tree';

/** Create form when `family` is null, edit form otherwise. Saves by itself. */
@Component({
  selector: 'app-family-form',
  imports: [ReactiveFormsModule, FieldErrorComponent, SelectSearchComponent],
  templateUrl: './family-form.component.html',
  styleUrl: './family-form.component.css',
})
export class FamilyFormComponent {
  private fb = inject(FormBuilder);
  private service = inject(FamiliesService);

  family = input<Family | null>(null);
  /** Every family, to choose the parent from. */
  families = input<Family[]>([]);
  saved = output<void>();
  cancelled = output<void>();

  saving = signal(false);
  formError = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});
  /** Text shown in the parent select; the form only holds the id. */
  parentLabel = signal('');

  // Same limits as FamilyRequest on the backend.
  form = this.fb.nonNullable.group({
    label: ['', [Validators.required, Validators.maxLength(100)]],
    displayOrder: [0, [Validators.required, Validators.min(0)]],
    parentId: [null as string | null],
  });

  /** In tree order. The family itself and its descendants are left out: the backend refuses cycles. */
  parentOptions = computed<SelectOption[]>(() => {
    const current = this.family();
    const excluded = current ? descendantIds(this.families(), current.id) : new Set<string>();

    return buildFamilyTree(this.families())
      .filter(row => !excluded.has(row.family.id))
      .map(row => ({ id: row.family.id, label: row.family.label }));
  });

  constructor() {
    // Refills the form whenever another family is selected while the panel stays open.
    effect(() => {
      const family = this.family();
      this.formError.set(null);
      this.fieldErrors.set({});
      this.parentLabel.set(family?.parentLabel ?? '');
      this.form.reset({
        label: family?.label ?? '',
        displayOrder: family?.displayOrder ?? 0,
        parentId: family?.parentId ?? null,
      });
    });
  }

  onParentSelected(option: SelectOption | null): void {
    this.form.controls.parentId.setValue(option?.id ?? null);
    this.parentLabel.set(option?.label ?? '');
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
    const family = this.family();
    const request = family ? this.service.update(family.id, body) : this.service.create(body);

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
