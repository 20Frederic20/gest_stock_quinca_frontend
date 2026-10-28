import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error.model';
import { ArticlePrice } from '../../core/models/article-price.model';
import { Privilege } from '../../core/models/privilege.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { addDays, minDateValidator, todayIso } from './price-rules';
import { PricesService } from './prices.service';

/**
 * Create form when `price` is null, edit form otherwise (only for a price that has not started).
 * Saves by itself.
 */
@Component({
  selector: 'app-price-form',
  imports: [ReactiveFormsModule, FieldErrorComponent, SelectSearchComponent],
  templateUrl: './price-form.component.html',
  styleUrl: './price-form.component.css',
})
export class PriceFormComponent {
  private fb = inject(FormBuilder);
  private service = inject(PricesService);

  price = input<ArticlePrice | null>(null);
  /** Packaging the new price belongs to. */
  packagingId = input.required<string>();
  privileges = input<Privilege[]>([]);
  /** Injected so that tests do not depend on the day they run. */
  today = input(todayIso());
  saved = output<void>();
  cancelled = output<void>();

  saving = signal(false);
  formError = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});
  /** Text shown in the privilege select; the form only holds the id. */
  privilegeLabel = signal('');

  /**
   * A new price may start today, not before: a past date would rewrite prices already invoiced.
   * An edited price must stay in the future, as the backend requires.
   */
  minStartDate = computed(() => (this.price() ? addDays(this.today(), 1) : this.today()));

  // Same rules as ArticlePriceRequest on the backend, plus the start date limit above.
  form = this.fb.nonNullable.group({
    privilegeId: ['', [Validators.required]],
    unitPrice: [null as number | null, [Validators.required, Validators.min(0)]],
    startDate: ['', [Validators.required, minDateValidator(() => this.minStartDate())]],
  });

  privilegeOptions = computed<SelectOption[]>(() =>
    this.privileges().map(privilege => ({ id: privilege.id, label: privilege.label })),
  );

  constructor() {
    // Refills the form whenever another price is selected while the panel stays open.
    effect(() => {
      const price = this.price();
      const today = this.today();
      // Read without tracking: a late privilege list must not wipe what the user typed.
      const defaultPrivilege = untracked(() => this.privileges().find(p => p.isDefault));

      this.formError.set(null);
      this.fieldErrors.set({});
      this.privilegeLabel.set(price?.privilegeLabel ?? defaultPrivilege?.label ?? '');
      this.form.reset({
        privilegeId: price?.privilegeId ?? defaultPrivilege?.id ?? '',
        unitPrice: price?.unitPrice ?? null,
        startDate: price?.startDate ?? today,
      });
    });
  }

  onPrivilegeSelected(option: SelectOption | null): void {
    this.form.controls.privilegeId.setValue(option?.id ?? '');
    this.form.controls.privilegeId.markAsTouched();
    this.privilegeLabel.set(option?.label ?? '');
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set(null);
    this.fieldErrors.set({});

    const value = this.form.getRawValue();
    const body = { privilegeId: value.privilegeId, unitPrice: value.unitPrice!, startDate: value.startDate };
    const price = this.price();
    const request = price ? this.service.update(price.id, body) : this.service.create(this.packagingId(), body);

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
