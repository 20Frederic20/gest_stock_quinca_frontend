import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { Agency } from '../../core/models/agency.model';
import { Expense, ExpenseCategory } from '../../core/models/expense.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { todayIso } from '../pricing/price-rules';
import { ExpensesService } from './expenses.service';

/** Id of the "Commune" option: it is not an agency, it is sent to the backend as a null agencyId. */
export const COMMON_OPTION_ID = '__common__';

/** Drawer form to enter or edit one charge. */
@Component({
  selector: 'app-expense-form',
  imports: [ReactiveFormsModule, SelectSearchComponent, FieldErrorComponent],
  templateUrl: './expense-form.component.html',
  styleUrl: './expense-form.component.css',
})
export class ExpenseFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private service = inject(ExpensesService);

  /** null while creating. */
  expense = input<Expense | null>(null);
  agencies = input<Agency[]>([]);
  /** Active categories only. */
  categories = input<ExpenseCategory[]>([]);

  saved = output<void>();
  cancelled = output<void>();

  saving = signal(false);
  formError = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});

  form = this.fb.nonNullable.group({
    expenseDate: [todayIso(), [Validators.required]],
    categoryId: ['', [Validators.required]],
    agencyId: ['', [Validators.required]],
    label: ['', [Validators.required, Validators.maxLength(200)]],
    amount: [0, [Validators.required, Validators.min(0.0001)]],
    note: ['', [Validators.maxLength(500)]],
  });

  canUseCommon = computed(() => this.auth.can('expenses.common'));

  categoryOptions = computed<SelectOption[]>(() => {
    const options = this.categories().map(c => ({ id: c.id, label: c.label }));
    const current = this.expense();
    // A deactivated category stays selectable on the charge that already uses it.
    if (current && !options.some(o => o.id === current.categoryId)) {
      options.push({ id: current.categoryId, label: `${current.categoryLabel} (désactivée)` });
    }
    return options;
  });

  agencyOptions = computed<SelectOption[]>(() => {
    const own = this.auth.user()?.agencyId;
    // A manager only enters charges for his own agency; the backend enforces it too.
    const agencies = this.canUseCommon() ? this.agencies() : this.agencies().filter(a => a.id === own);
    const options = agencies.map(a => ({ id: a.id, label: a.label }));
    return this.canUseCommon() ? [{ id: COMMON_OPTION_ID, label: 'Commune (sans agence)' }, ...options] : options;
  });

  categoryLabel = computed(() => this.categoryOptions().find(o => o.id === this.categoryId())?.label ?? '');
  agencyLabel = computed(() => this.agencyOptions().find(o => o.id === this.agencyId())?.label ?? '');

  private categoryId = signal('');
  private agencyId = signal('');
  protected selectedCategory = this.categoryId.asReadonly();
  protected selectedAgency = this.agencyId.asReadonly();

  ngOnInit(): void {
    const expense = this.expense();
    if (expense) {
      this.form.patchValue({
        expenseDate: expense.expenseDate,
        categoryId: expense.categoryId,
        agencyId: expense.agencyId ?? COMMON_OPTION_ID,
        label: expense.label,
        amount: expense.amount,
        note: expense.note ?? '',
      });
    } else if (!this.canUseCommon()) {
      this.form.controls.agencyId.setValue(this.auth.user()?.agencyId ?? '');
    }
    this.categoryId.set(this.form.controls.categoryId.value);
    this.agencyId.set(this.form.controls.agencyId.value);
  }

  onCategorySelected(option: SelectOption | null): void {
    this.categoryId.set(option?.id ?? '');
    this.form.controls.categoryId.setValue(option?.id ?? '');
  }

  onAgencySelected(option: SelectOption | null): void {
    this.agencyId.set(option?.id ?? '');
    this.form.controls.agencyId.setValue(option?.id ?? '');
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
    const body = {
      expenseDate: value.expenseDate,
      categoryId: value.categoryId,
      agencyId: value.agencyId === COMMON_OPTION_ID ? null : value.agencyId,
      label: value.label.trim(),
      amount: value.amount,
      note: value.note.trim() || null,
    };
    const expense = this.expense();
    const request = expense ? this.service.update(expense.id, body) : this.service.create(body);

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
